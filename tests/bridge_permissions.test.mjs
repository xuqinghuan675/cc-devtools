import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPermissionArgs, fileWriteEnabled, normalizePermissionMode } from '../bridge/permissions.js';

test('Node bridge defaults to auto permission mode', () => {
  assert.equal(normalizePermissionMode(undefined, {}), 'auto');
  assert.deepEqual(buildPermissionArgs(undefined, {}), ['--permission-mode', 'auto']);
});

test('Node bridge accepts explicit plan and bypass permission modes', () => {
  assert.equal(normalizePermissionMode('plan', {}), 'plan');
  assert.equal(normalizePermissionMode('bypassPermissions', {}), 'bypassPermissions');
  assert.equal(normalizePermissionMode(undefined, { CC_DEVTOOLS_PERMISSION_MODE: ' plan ' }), 'plan');
});

test('Node bridge falls back to auto for unknown permission modes', () => {
  assert.equal(normalizePermissionMode('not-real', {}), 'auto');
});

test('legacy bypass env only applies when the panel does not send a mode', () => {
  const env = { CC_DEVTOOLS_BYPASS: '1' };

  assert.equal(normalizePermissionMode(undefined, env), 'bypassPermissions');
  assert.equal(normalizePermissionMode('auto', env), 'auto');
});

test('Node bridge local writes require explicit write env opt-in', () => {
  assert.equal(fileWriteEnabled({}), false);
  assert.equal(fileWriteEnabled({ CC_DEVTOOLS_ENABLE_WRITE: '1' }), true);
});
