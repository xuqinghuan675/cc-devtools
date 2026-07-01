import { readdirSync, readFileSync, statSync } from 'fs';
import { isAbsolute, join, relative, resolve, sep } from 'path';

import { resolveWritePath } from './safety.js';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__']);
const MAX_FILES = 200;
const MAX_READ_CHARS = 20000;
const MAX_READ_LIMIT = 100000;

function isExcluded(relPath) {
  return relPath.split(/[\\/]/).some((part) => EXCLUDED_DIRS.has(part) || part.endsWith('.egg-info'));
}

function matchesPattern(relPath, pattern) {
  const query = (pattern || '**/*').trim().toLowerCase();
  const rel = relPath.toLowerCase();
  if (query === '**/*' || query === '*' || query === '*.*') return true;
  if (query.startsWith('*.')) return rel.endsWith(query.slice(1));
  if (query.startsWith('**/*.')) return rel.endsWith(query.slice(4));
  return rel.includes(query.replaceAll('*', ''));
}

function normalizePattern(root, pattern) {
  const query = (pattern || '**/*').trim() || '**/*';
  if (!isAbsolute(query)) return query;

  const rootAbs = resolve(root);
  const queryAbs = resolve(query);
  const rel = relative(rootAbs, queryAbs).split(sep).join('/');
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error('file list pattern is outside allowed root');
  }
  return rel || '**/*';
}

export function listFiles(root, pattern = '**/*') {
  const results = [];
  const query = normalizePattern(root, pattern);

  function walk(dir) {
    if (results.length >= MAX_FILES) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = relative(root, abs).split(sep).join('/');
      if (isExcluded(rel)) continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && matchesPattern(rel, query)) {
        results.push(rel);
      }
      if (results.length >= MAX_FILES) return;
    }
  }

  walk(root);
  return results.sort();
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function nextReadAction(path, offset, limit) {
  const payload = JSON.stringify({ path, offset, limit });
  return `Next: [ACTION:file:read]${payload}[/ACTION]`;
}

export function readFileInsideRoot(path, root, options = {}) {
  const filePath = resolveWritePath(path, root);
  if (!statSync(filePath).isFile()) {
    throw new Error(`file not found: ${path}`);
  }
  const content = readFileSync(filePath, 'utf8');
  const total = content.length;
  const start = clampInt(options.offset, 0, 0, total);
  const limit = clampInt(options.limit, MAX_READ_CHARS, 1, MAX_READ_LIMIT);
  const end = Math.min(start + limit, total);
  const page = content.slice(start, end);

  if (end < total) {
    return `${page}\n[truncated at ${end} of ${total} chars]\n${nextReadAction(path, end, limit)}`;
  }
  if (start > 0) {
    return `[file page ${start}-${end} of ${total} chars]\n${page}`;
  }
  return page;
}
