import { timingSafeEqual } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { extname } from 'path';

import { resolveWritePath } from './safety.js';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function response(status, body = '', headers = {}) {
  return {
    status,
    headers,
    body: Buffer.isBuffer(body) ? body : Buffer.from(String(body)),
  };
}

function headerValue(headers, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return String(value[0] || '');
    return String(value || '');
  }
  return '';
}

export function requestToken(req) {
  const queryText = String(req?.url || '').split('?')[1] || '';
  const queryToken = new URLSearchParams(queryText).get('token');
  if (queryToken) return queryToken;

  const headerToken = headerValue(req?.headers, 'X-CC-DevTools-Token');
  if (headerToken) return headerToken;

  const auth = headerValue(req?.headers, 'Authorization');
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

export function tokenAuthorized(token, env = process.env) {
  const expected = String(env.CC_DEVTOOLS_TOKEN || '').trim();
  if (!expected) return true;

  const actual = String(token || '');
  if (!actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requestTokenAuthorized(req, env = process.env) {
  return tokenAuthorized(requestToken(req), env);
}

function requestPathname(req) {
  return String(req?.url || '/').split('?')[0].split('#')[0];
}

function fileRequestPath(req) {
  const pathname = requestPathname(req);
  if (!pathname.startsWith('/files/')) return null;
  try {
    return decodeURIComponent(pathname.slice('/files/'.length));
  } catch {
    throw new Error('invalid file path encoding');
  }
}

export function readStaticFileRequest(req, root, env = process.env) {
  let rawPath;
  try {
    rawPath = fileRequestPath(req);
  } catch {
    return response(400, 'bad request');
  }
  if (rawPath === null) return response(404);

  if (!requestTokenAuthorized(req, env)) {
    return response(401, 'unauthorized');
  }

  let filePath;
  try {
    filePath = resolveWritePath(rawPath, root);
  } catch {
    return response(403, 'forbidden');
  }

  try {
    if (!statSync(filePath).isFile()) {
      return response(404);
    }
    return response(200, readFileSync(filePath), {
      'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
  } catch {
    return response(404);
  }
}
