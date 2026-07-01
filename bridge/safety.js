import { isAbsolute, relative, resolve } from 'path';

const SENSITIVE_FILE_NAMES = new Set([
  '.env',
  '.npmrc',
  '.pypirc',
  '.netrc',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa',
]);
const SENSITIVE_DIR_FILE_PAIRS = new Set(['.git/config', '.ssh/config']);

export function getWriteRoot(env = process.env, cwd = process.cwd()) {
  return resolve(env.CC_DEVTOOLS_WRITE_ROOT || cwd);
}

export function isSensitivePath(path) {
  const parts = String(path || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  if (parts.length === 0) return false;

  const name = parts[parts.length - 1];
  if (SENSITIVE_FILE_NAMES.has(name) || name.startsWith('.env.')) {
    return true;
  }

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (SENSITIVE_DIR_FILE_PAIRS.has(`${parts[i]}/${parts[i + 1]}`)) {
      return true;
    }
  }

  return false;
}

export function resolveWritePath(rawPath, root = getWriteRoot()) {
  const text = String(rawPath ?? '').trim();
  if (!text) {
    throw new Error('write path is empty');
  }

  const allowedRoot = resolve(root);
  const candidate = isAbsolute(text) ? resolve(text) : resolve(allowedRoot, text);
  const rel = relative(allowedRoot, candidate);

  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    if (isSensitivePath(rel)) {
      throw new Error(`sensitive path is not allowed: ${rel}`);
    }
    return candidate;
  }

  throw new Error(`write path is outside allowed root: ${allowedRoot}`);
}
