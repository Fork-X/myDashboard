import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  appendGoalProgress,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from '../db/goals.mjs';
import { listThoughts } from '../db/thoughts.mjs';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../db/todos.mjs';
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

export function createHandler({ db, publicDir }) {
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
