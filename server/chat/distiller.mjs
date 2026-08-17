import { resolve } from 'node:path';
import { getConversation } from '../db/conversations.mjs';
import { loadSystemPrompt } from '../prompt.mjs';

const MESSAGE_MAX_CHARS = 2000;

function buildTranscript(messages) {
  return messages.map((message) => {
    const speaker = message.role === 'user' ? 'user' : 'assistant';
    const content = message.content.length > MESSAGE_MAX_CHARS
      ? `${message.content.slice(0, MESSAGE_MAX_CHARS)}…`
      : message.content;
    return `${speaker}: ${content}`;
  }).join('\n\n');
}

function buildPrompt(transcript, focus) {
  const focusLine = focus ? `\n\n关注角度：${focus}` : '';
  return `将以下对话记录提炼为一份思考精华草稿。严格按系统提示词中的输出契约只返回 JSON。\n\n${transcript}${focusLine}`;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw Object.assign(new Error('提炼结果解析失败'), { status: 502 });
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw Object.assign(new Error('提炼结果解析失败'), { status: 502 });
  }
}

function normalizeDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.shouldSave !== 'boolean') {
    throw Object.assign(new Error('提炼结果解析失败'), { status: 502 });
  }
  if (!value.shouldSave) {
    return {
      shouldSave: false,
      reason: typeof value.reason === 'string' && value.reason.trim()
        ? value.reason.trim()
        : '本次对话没有可沉淀的精华',
    };
  }
  if (typeof value.title !== 'string' || !value.title.trim()
    || typeof value.content !== 'string' || !value.content.trim()) {
    throw Object.assign(new Error('提炼结果解析失败'), { status: 502 });
  }
  const tags = [];
  if (Array.isArray(value.tags)) {
    for (const item of value.tags) {
      if (typeof item !== 'string') {
        throw Object.assign(new Error('提炼结果解析失败'), { status: 502 });
      }
      const tag = item.trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  return {
    shouldSave: true,
    title: value.title.trim(),
    content: value.content.trim(),
    tags,
  };
}

export function createDistiller({ db, queryFn, projectRoot }) {
  // skill 内容住在仓库目录 skills/distill/，读文件注入 systemPrompt 而非使用
  // SDK 的 Skill 发现机制：不依赖 .qoder/ 目录，换任何 agent SDK 都成立。
  let skillPromise = null;
  const loadSkill = () => {
    skillPromise ??= loadSystemPrompt(resolve(projectRoot, 'skills/distill'), 'SKILL.md');
    return skillPromise;
  };

  return {
    async distill(conversationId, focus = '') {
      const detail = getConversation(db, conversationId);
      if (!detail) return null;
      if (detail.messages.length === 0) {
        return { shouldSave: false, reason: '对话还没有消息，先聊几句再沉淀' };
      }

      const skillText = await loadSkill();
      const q = queryFn({
        prompt: buildPrompt(buildTranscript(detail.messages), focus.trim()),
        options: {
          cwd: projectRoot,
          allowedTools: [],
          systemPrompt: { type: 'preset', preset: 'qodercli', append: skillText },
        },
      });

      let text = '';
      try {
        for await (const msg of q) {
          if (msg.type === 'assistant') {
            const blocks = msg.message?.content ?? [];
            text += blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
          }
        }
      } finally {
        await q.close?.().catch(() => {});
      }
      return normalizeDraft(extractJson(text));
    },
  };
}
