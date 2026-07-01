const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const PERMISSION_MODES = new Set(['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan']);
const DEFAULT_PERMISSION_MODE = 'auto';

function truthyEnvValue(value) {
  return TRUTHY_VALUES.has(String(value || '').trim().toLowerCase());
}

function envPermissionMode(env = process.env) {
  if (truthyEnvValue(env.CC_DEVTOOLS_BYPASS)) {
    return 'bypassPermissions';
  }
  return String(env.CC_DEVTOOLS_PERMISSION_MODE || '').trim() || DEFAULT_PERMISSION_MODE;
}

export function normalizePermissionMode(mode, env = process.env) {
  const explicit = typeof mode === 'string' ? mode.trim() : '';
  const candidate = explicit || envPermissionMode(env);
  return PERMISSION_MODES.has(candidate) ? candidate : DEFAULT_PERMISSION_MODE;
}

export function buildPermissionArgs(mode, env = process.env) {
  return ['--permission-mode', normalizePermissionMode(mode, env)];
}

export function fileWriteEnabled(env = process.env) {
  return truthyEnvValue(env.CC_DEVTOOLS_ENABLE_WRITE);
}
