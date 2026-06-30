import { isAbsolute, relative, resolve } from 'path';

export function getWriteRoot(env = process.env, cwd = process.cwd()) {
  return resolve(env.CC_DEVTOOLS_WRITE_ROOT || cwd);
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
    return candidate;
  }

  throw new Error(`write path is outside allowed root: ${allowedRoot}`);
}
