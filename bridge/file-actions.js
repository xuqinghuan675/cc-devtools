import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import { resolveWritePath } from './safety.js';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__']);
const MAX_FILES = 200;
const MAX_READ_CHARS = 20000;

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

export function listFiles(root, pattern = '**/*') {
  const results = [];

  function walk(dir) {
    if (results.length >= MAX_FILES) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = relative(root, abs).split(sep).join('/');
      if (isExcluded(rel)) continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && matchesPattern(rel, pattern)) {
        results.push(rel);
      }
      if (results.length >= MAX_FILES) return;
    }
  }

  walk(root);
  return results.sort();
}

export function readFileInsideRoot(path, root) {
  const filePath = resolveWritePath(path, root);
  if (!statSync(filePath).isFile()) {
    throw new Error(`file not found: ${path}`);
  }
  return readFileSync(filePath, 'utf8').slice(0, MAX_READ_CHARS);
}
