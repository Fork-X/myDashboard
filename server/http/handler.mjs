import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  appendGoalProgress,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from '../db/goals.mjs';
import {
  createConversation,
  deleteConversation,
  getConversation,
} from '../db/conversations.mjs';
import { insertThought, listThoughts } from '../db/thoughts.mjs';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../db/todos.mjs';
import {
  convertInboxItem,
  createDirection,
  createEvent,
  createInboxItem,
  createTicker,
  deleteDirection,
  deleteEvent,
  deleteTicker,
  ignoreInboxItem,
  listAllTags,
  listDirections,
  listEvents,
  listInboxItems,
  listTickers,
  updateDirection,
  updateEvent,
  updateInboxItem,
} from '../db/investment.mjs';
import { readJson, sendError, sendJson } from './response.mjs';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function isFile(filename) {
  try {
    return (await stat(filename)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

async function resolveFileInside(root, candidate) {
  let filename;
  try {
    filename = await realpath(candidate);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
  if (!isInside(root, filename)) {
    throw Object.assign(new Error('禁止访问公共目录之外的路径'), { status: 403 });
  }
  return await isFile(filename) ? filename : null;
}

async function sendFile(response, filename) {
  const content = await readFile(filename);
  const contentType = contentTypes.get(extname(filename).toLowerCase());
  response.writeHead(200, contentType ? { 'content-type': contentType } : {});
  response.end(content);
}

function decodeId(pathname) {
  return decodePathSegment(pathname.split('/').at(-1));
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw Object.assign(new Error('请求路径无效'), { status: 400 });
  }
}

function invalidBody(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof TypeError) error.status = 400;
    throw error;
  }
}

function sendMissingGoal(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '目标不存在' },
  });
}

function sendMissingTodo(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: 'TODO 不存在' },
  });
}

function sendMissingConversation(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '对话不存在' },
  });
}

function sendMissingEvent(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '事件不存在' },
  });
}

function sendMissingTicker(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '标的不存在' },
  });
}

function sendMissingDirection(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '题材不存在' },
  });
}

function sendMissingInboxItem(response) {
  return sendJson(response, 404, {
    error: { code: 'NOT_FOUND', message: '收件箱条目不存在' },
  });
}

function sendChatDisabled(response) {
  return sendJson(response, 503, {
    error: { code: 'CHAT_DISABLED', message: '对话功能未启用' },
  });
}

function readMessageBody(request) {
  // Chat messages may contain long pasted text (articles, code) — allow up to 1MB.
  return readJson(request, 1024 * 1024).then((body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.content !== 'string' || !body.content.trim()) {
      throw Object.assign(new Error('消息内容无效'), { status: 400 });
    }
    return body.content;
  });
}

function streamChat(request, response, chatManager, conversationId) {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });
  response.write(': connected\n\n');
  const unsubscribe = chatManager.subscribe(conversationId, (event) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => response.write(': ping\n\n'), 25000);
  request.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

export function createHandler({
  db, publicDir, chatManager = null, distiller = null, scanner = null,
}) {
  const publicRoot = resolve(publicDir);

  return async function handler(request, response) {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const { pathname } = url;
      const method = request.method ?? 'GET';

      if (method === 'GET' && pathname === '/api/health') {
        return sendJson(response, 200, { data: { status: 'ok' } });
      }
      if (method === 'GET' && pathname === '/api/thoughts') {
        return sendJson(response, 200, { data: listThoughts(db) });
      }
      if (method === 'POST' && pathname === '/api/thoughts') {
        const body = await readJson(request);
        const { thought, inserted } = invalidBody(() => insertThought(db, body));
        return sendJson(response, inserted ? 201 : 200, { data: thought });
      }
      if (method === 'GET' && pathname === '/api/goals') {
        return sendJson(response, 200, { data: listGoals(db) });
      }
      if (method === 'POST' && pathname === '/api/goals') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createGoal(db, body)) });
      }
      if (method === 'PATCH' && /^\/api\/goals\/[^/]+$/.test(pathname)) {
        const body = await readJson(request);
        const item = invalidBody(() => updateGoal(db, decodeId(pathname), body));
        return item ? sendJson(response, 200, { data: item }) : sendMissingGoal(response);
      }
      if (method === 'DELETE' && /^\/api\/goals\/[^/]+$/.test(pathname)) {
        const item = deleteGoal(db, decodeId(pathname));
        return item ? sendJson(response, 200, { data: item }) : sendMissingGoal(response);
      }
      const progressMatch = pathname.match(/^\/api\/goals\/([^/]+)\/progress$/);
      if (method === 'POST' && progressMatch) {
        const body = await readJson(request);
        const item = invalidBody(() => appendGoalProgress(
          db,
          decodePathSegment(progressMatch[1]),
          body,
        ));
        return item ? sendJson(response, 201, { data: item }) : sendMissingGoal(response);
      }
      if (method === 'GET' && pathname === '/api/todos') {
        return sendJson(response, 200, { data: listTodos(db) });
      }
      if (method === 'POST' && pathname === '/api/todos') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createTodo(db, body)) });
      }
      if (method === 'PATCH' && /^\/api\/todos\/[^/]+$/.test(pathname)) {
        const body = await readJson(request);
        const item = invalidBody(() => updateTodo(db, decodeId(pathname), body));
        return item ? sendJson(response, 200, { data: item }) : sendMissingTodo(response);
      }
      if (method === 'DELETE' && /^\/api\/todos\/[^/]+$/.test(pathname)) {
        const item = deleteTodo(db, decodeId(pathname));
        return item ? sendJson(response, 200, { data: item }) : sendMissingTodo(response);
      }
      if (method === 'GET' && pathname === '/api/chats') {
        if (!chatManager) return sendChatDisabled(response);
        return sendJson(response, 200, { data: chatManager.list() });
      }
      if (method === 'POST' && pathname === '/api/chats') {
        if (!chatManager) return sendChatDisabled(response);
        return sendJson(response, 201, { data: createConversation(db) });
      }
      const chatMatch = pathname.match(/^\/api\/chats\/([^/]+)$/);
      if (method === 'GET' && chatMatch) {
        if (!chatManager) return sendChatDisabled(response);
        const detail = getConversation(db, decodePathSegment(chatMatch[1]));
        return detail ? sendJson(response, 200, { data: detail }) : sendMissingConversation(response);
      }
      if (method === 'DELETE' && chatMatch) {
        if (!chatManager) return sendChatDisabled(response);
        const item = deleteConversation(db, decodePathSegment(chatMatch[1]));
        return item ? sendJson(response, 200, { data: item }) : sendMissingConversation(response);
      }
      const messagesMatch = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
      if (method === 'POST' && messagesMatch) {
        if (!chatManager) return sendChatDisabled(response);
        const conversationId = decodePathSegment(messagesMatch[1]);
        const content = await readMessageBody(request);
        const message = await chatManager.send(conversationId, content);
        return message
          ? sendJson(response, 201, { data: message })
          : sendMissingConversation(response);
      }
      const streamMatch = pathname.match(/^\/api\/chats\/([^/]+)\/stream$/);
      if (method === 'GET' && streamMatch) {
        if (!chatManager) return sendChatDisabled(response);
        const conversationId = decodePathSegment(streamMatch[1]);
        if (!getConversation(db, conversationId)) return sendMissingConversation(response);
        return streamChat(request, response, chatManager, conversationId);
      }
      const distillMatch = pathname.match(/^\/api\/chats\/([^/]+)\/distill$/);
      if (method === 'POST' && distillMatch) {
        if (!chatManager || !distiller) return sendChatDisabled(response);
        const body = await readJson(request);
        if (body.focus !== undefined && typeof body.focus !== 'string') {
          throw Object.assign(new Error('关注角度无效'), { status: 400 });
        }
        const draft = await distiller.distill(
          decodePathSegment(distillMatch[1]),
          body.focus ?? '',
        );
        return draft ? sendJson(response, 200, { data: draft }) : sendMissingConversation(response);
      }
      if (method === 'GET' && pathname === '/api/events') {
        return sendJson(response, 200, { data: listEvents(db) });
      }
      if (method === 'POST' && pathname === '/api/events') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createEvent(db, body)) });
      }
      const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
      if (method === 'GET' && eventMatch) {
        const event = listEvents(db).find((e) => e.id === decodePathSegment(eventMatch[1]));
        return event ? sendJson(response, 200, { data: event }) : sendMissingEvent(response);
      }
      if (method === 'PATCH' && eventMatch) {
        const body = await readJson(request);
        const item = invalidBody(() => updateEvent(db, decodePathSegment(eventMatch[1]), body));
        return item ? sendJson(response, 200, { data: item }) : sendMissingEvent(response);
      }
      if (method === 'DELETE' && eventMatch) {
        const item = deleteEvent(db, decodePathSegment(eventMatch[1]));
        return item ? sendJson(response, 200, { data: item }) : sendMissingEvent(response);
      }
      if (method === 'GET' && pathname === '/api/tickers') {
        return sendJson(response, 200, { data: listTickers(db) });
      }
      if (method === 'POST' && pathname === '/api/tickers') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createTicker(db, body)) });
      }
      const tickerMatch = pathname.match(/^\/api\/tickers\/([^/]+)$/);
      if (method === 'DELETE' && tickerMatch) {
        const item = deleteTicker(db, decodePathSegment(tickerMatch[1]));
        return item ? sendJson(response, 200, { data: item }) : sendMissingTicker(response);
      }
      if (method === 'GET' && pathname === '/api/directions') {
        return sendJson(response, 200, { data: listDirections(db) });
      }
      if (method === 'GET' && pathname === '/api/domains') {
        if (!scanner || !scanner.listDomains) {
          return sendJson(response, 200, { data: [] });
        }
        try {
          const domains = await scanner.listDomains();
          return sendJson(response, 200, { data: domains });
        } catch {
          return sendJson(response, 200, { data: [] });
        }
      }
      if (method === 'POST' && pathname === '/api/directions') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createDirection(db, body)) });
      }
      const directionMatch = pathname.match(/^\/api\/directions\/([^/]+)$/);
      if (method === 'PATCH' && directionMatch) {
        const body = await readJson(request);
        const item = invalidBody(() => updateDirection(db, decodePathSegment(directionMatch[1]), body));
        return item ? sendJson(response, 200, { data: item }) : sendMissingDirection(response);
      }
      if (method === 'DELETE' && directionMatch) {
        const item = deleteDirection(db, decodePathSegment(directionMatch[1]));
        return item ? sendJson(response, 200, { data: item }) : sendMissingDirection(response);
      }
      const scanMatch = pathname.match(/^\/api\/directions\/([^/]+)\/scan$/);
      if (method === 'POST' && scanMatch) {
        if (!scanner) return sendJson(response, 503, {
          error: { code: 'SCAN_DISABLED', message: '扫描功能未启用' },
        });
        try {
          const result = await scanner.scanDirection(decodePathSegment(scanMatch[1]));
          return sendJson(response, 200, { data: result });
        } catch (error) {
          return sendJson(response, error.status || 500, {
            error: { code: 'SCAN_FAILED', message: error.message },
          });
        }
      }
      if (method === 'GET' && pathname === '/api/inbox') {
        return sendJson(response, 200, { data: listInboxItems(db) });
      }
      if (method === 'POST' && pathname === '/api/inbox') {
        const body = await readJson(request);
        return sendJson(response, 201, { data: invalidBody(() => createInboxItem(db, body)) });
      }
      const inboxMatch = pathname.match(/^\/api\/inbox\/([^/]+)$/);
      if (method === 'PATCH' && inboxMatch) {
        const body = await readJson(request);
        const item = invalidBody(() => updateInboxItem(db, decodePathSegment(inboxMatch[1]), body));
        return item ? sendJson(response, 200, { data: item }) : sendMissingInboxItem(response);
      }
      const convertMatch = pathname.match(/^\/api\/inbox\/([^/]+)\/convert$/);
      if (method === 'POST' && convertMatch) {
        const result = invalidBody(() => convertInboxItem(db, decodePathSegment(convertMatch[1])));
        return result ? sendJson(response, 200, { data: result }) : sendMissingInboxItem(response);
      }
      const ignoreMatch = pathname.match(/^\/api\/inbox\/([^/]+)\/ignore$/);
      if (method === 'POST' && ignoreMatch) {
        const result = invalidBody(() => ignoreInboxItem(db, decodePathSegment(ignoreMatch[1])));
        return result ? sendJson(response, 200, { data: result }) : sendMissingInboxItem(response);
      }
      if (method === 'GET' && pathname === '/api/tags') {
        return sendJson(response, 200, { data: listAllTags(db) });
      }
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return sendJson(response, 404, {
          error: { code: 'NOT_FOUND', message: '接口不存在' },
        });
      }

      if (method !== 'GET') {
        response.writeHead(404);
        return response.end();
      }

      let decodedPath;
      try {
        decodedPath = decodeURIComponent((request.url ?? '/').split('?')[0] || '/');
      } catch {
        throw Object.assign(new Error('请求路径无效'), { status: 400 });
      }
      const requestedFile = resolve(publicRoot, `.${decodedPath}`);
      if (!isInside(publicRoot, requestedFile)) {
        throw Object.assign(new Error('禁止访问公共目录之外的路径'), { status: 403 });
      }
      const realRoot = await realpath(publicRoot);
      const filename = await resolveFileInside(realRoot, requestedFile)
        ?? await resolveFileInside(realRoot, resolve(publicRoot, 'index.html'));
      if (!filename) throw new Error('公共页面不存在');
      return sendFile(response, filename);
    } catch (error) {
      return sendError(response, error);
    }
  };
}
