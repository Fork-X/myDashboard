import { appendMessage, getConversation, listConversations } from '../db/conversations.mjs';
import { resolveModelPolicy } from './model-policy.mjs';

const DEFAULT_MAX_ACTIVE = 2;
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const HISTORY_REPLAY_LIMIT = 20;
const HISTORY_MESSAGE_MAX_CHARS = 2000;
const AUTO_APPROVED_TOOLS = [
  'WebSearch',
  'WebFetch',
  'Read',
  'Glob',
  'Grep',
  'ImageSearch',
  'Agent',
  'Skill',
  'TodoWrite',
];

export function createChatSessionManager({
  db,
  queryFn,
  projectRoot,
  maxActive = DEFAULT_MAX_ACTIVE,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  now = () => new Date(),
}) {
  const sessions = new Map();
  const listenersByConversation = new Map();

  const sweeper = setInterval(() => sweepIdle(), SWEEP_INTERVAL_MS);
  sweeper.unref();

  function broadcast(conversationId, event) {
    const listeners = listenersByConversation.get(conversationId);
    if (!listeners) return;
    for (const listener of listeners) listener(event);
  }

  function sweepIdle() {
    const cutoff = now().getTime() - idleTimeoutMs;
    for (const session of sessions.values()) {
      if (!session.busy && session.lastActiveAt.getTime() < cutoff) {
        void closeSession(session.conversationId);
      }
    }
  }

  function evictOldestIdle() {
    let oldest = null;
    for (const session of sessions.values()) {
      if (session.busy) continue;
      if (!oldest || session.lastActiveAt < oldest.lastActiveAt) oldest = session;
    }
    if (!oldest) return false;
    void closeSession(oldest.conversationId);
    return true;
  }

  function replayMessages(conversationId) {
    const detail = getConversation(db, conversationId);
    if (!detail || detail.messages.length === 0) return [];
    const recent = detail.messages.slice(-HISTORY_REPLAY_LIMIT);
    const lines = recent.map((message) => {
      const speaker = message.role === 'user' ? '用户' : 'AI';
      const content = message.content.length > HISTORY_MESSAGE_MAX_CHARS
        ? `${message.content.slice(0, HISTORY_MESSAGE_MAX_CHARS)}…`
        : message.content;
      return `${speaker}: ${content}`;
    });
    return [{
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'text',
          text: `以下是我们在本会话中的历史对话记录，仅作为背景上下文注入，不要回复它；之后的用户消息才是需要回复的内容。\n\n${lines.join('\n\n')}`,
        }],
      },
      parent_tool_use_id: null,
      shouldQuery: false,
    }];
  }

  function startSession(conversationId) {
    if (sessions.size >= maxActive && !evictOldestIdle()) {
      return null;
    }

    const inbox = createInbox();
    const session = {
      conversationId,
      inbox,
      busy: false,
      lastActiveAt: now(),
      closed: false,
      query: null,
    };
    sessions.set(conversationId, session);

    const q = queryFn({
      prompt: chain(replayMessages(conversationId), inbox.iterator()),
      options: {
        cwd: projectRoot,
        allowedTools: AUTO_APPROVED_TOOLS,
        includePartialMessages: true,
        ...resolveModelPolicy(),
      },
    });
    session.query = q;
    session.loop = consume(session, q);
    return session;
  }

  async function consume(session, q) {
    let text = '';
    let thinking = '';
    let turnOutput = false;
    try {
      for await (const msg of q) {
        if (session.closed) break;
        if (msg.type === 'stream_event') {
          const delta = msg.event?.delta;
          if (delta?.type === 'text_delta') {
            turnOutput = true;
            text += delta.text;
            broadcast(session.conversationId, { type: 'delta', text: delta.text });
          } else if (delta?.type === 'thinking_delta') {
            turnOutput = true;
            thinking += delta.thinking;
            broadcast(session.conversationId, { type: 'thinking', text: delta.thinking });
          }
        } else if (msg.type === 'assistant') {
          turnOutput = true;
          const blocks = msg.message?.content ?? [];
          const fullText = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
          const fullThinking = blocks
            .filter((b) => b.type === 'thinking')
            .map((b) => b.thinking)
            .join('');
          const content = fullText || text;
          if (content.trim()) {
            const saved = appendMessage(db, session.conversationId, {
              role: 'assistant',
              content,
              thinking: fullThinking || thinking || null,
            });
            if (saved) broadcast(session.conversationId, { type: 'message', message: saved });
          }
          text = '';
          thinking = '';
        } else if (msg.type === 'result') {
          session.busy = false;
          session.lastActiveAt = now();
          if (turnOutput) {
            broadcast(session.conversationId, { type: 'turn_end', subtype: msg.subtype });
          }
          turnOutput = false;
        }
      }
    } catch (error) {
      session.busy = false;
      broadcast(session.conversationId, {
        type: 'error',
        message: error instanceof Error ? error.message : '对话会话异常',
      });
    } finally {
      if (!session.closed) {
        session.closed = true;
        sessions.delete(session.conversationId);
        broadcast(session.conversationId, { type: 'session_closed' });
      }
    }
  }

  async function closeSession(conversationId) {
    const session = sessions.get(conversationId);
    if (!session || session.closed) return;
    session.closed = true;
    sessions.delete(conversationId);
    broadcast(conversationId, { type: 'session_closed' });
    session.inbox.close();
    try {
      await session.query?.close();
    } catch {
      // The consume loop reports the underlying error already.
    }
  }

  function ensureSession(conversationId) {
    const existing = sessions.get(conversationId);
    if (existing && !existing.closed) return existing;
    return startSession(conversationId);
  }

  return {
    list() {
      return listConversations(db);
    },

    get(conversationId) {
      return getConversation(db, conversationId);
    },

    async send(conversationId, content) {
      const userMessage = appendMessage(db, conversationId, { role: 'user', content });
      if (!userMessage) return null;
      broadcast(conversationId, { type: 'message', message: userMessage });

      const session = ensureSession(conversationId);
      if (!session) {
        broadcast(conversationId, {
          type: 'error',
          message: '活跃对话已达上限，请等待当前回复完成后再试',
        });
        return userMessage;
      }
      session.busy = true;
      session.lastActiveAt = now();
      session.inbox.push({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: userMessage.content }] },
        parent_tool_use_id: null,
      });
      return userMessage;
    },

    subscribe(conversationId, listener) {
      let listeners = listenersByConversation.get(conversationId);
      if (!listeners) {
        listeners = new Set();
        listenersByConversation.set(conversationId, listeners);
      }
      listeners.add(listener);
      const session = sessions.get(conversationId);
      listener({
        type: 'status',
        active: Boolean(session && !session.closed),
        busy: Boolean(session?.busy),
      });
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) listenersByConversation.delete(conversationId);
      };
    },

    isBusy(conversationId) {
      return Boolean(sessions.get(conversationId)?.busy);
    },

    activeCount() {
      return sessions.size;
    },

    async closeAll() {
      for (const conversationId of [...sessions.keys()]) {
        await closeSession(conversationId);
      }
    },
  };
}

function createInbox() {
  const queue = [];
  let resolver = null;
  let closed = false;
  return {
    push(message) {
      if (closed) return;
      if (resolver) {
        const resolve = resolver;
        resolver = null;
        resolve({ value: message, done: false });
      } else {
        queue.push(message);
      }
    },
    close() {
      closed = true;
      if (resolver) {
        const resolve = resolver;
        resolver = null;
        resolve({ value: undefined, done: true });
      }
    },
    async *iterator() {
      for (;;) {
        if (queue.length > 0) {
          yield queue.shift();
          continue;
        }
        if (closed) return;
        const result = await new Promise((resolve) => {
          resolver = resolve;
        });
        if (result.done) return;
        yield result.value;
      }
    },
  };
}

async function* chain(prefix, iterator) {
  for (const message of prefix) yield message;
  yield* iterator;
}
