import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { resolveWritePath } from '../bridge/safety.js';

test('relative write paths stay inside the configured root', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));

  assert.equal(resolveWritePath('nested/file.txt', root), join(root, 'nested', 'file.txt'));
});

test('parent traversal is rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));

  assert.throws(() => resolveWritePath('../outside.txt', root), /outside allowed root/);
});

test('absolute paths outside the root are rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  const outside = join(dirname(root), 'outside.txt');

  assert.throws(() => resolveWritePath(outside, root), /outside allowed root/);
});

test('empty paths are rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));

  assert.throws(() => resolveWritePath('   ', root), /empty/);
});
