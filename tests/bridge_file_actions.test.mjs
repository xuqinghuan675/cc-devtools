import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { listFiles, readFileInsideRoot } from '../bridge/file-actions.js';

test('listFiles filters generated directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'CountrySelect.tsx'), '');
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'node_modules', 'package.js'), '');

  assert.deepEqual(listFiles(root, '*.tsx'), ['src/CountrySelect.tsx']);
});

test('readFileInsideRoot reads text inside root', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data', 'countries.json'), '[{"code":"US"}]');

  assert.equal(readFileInsideRoot('data/countries.json', root), '[{"code":"US"}]');
});

test('readFileInsideRoot marks truncated output with next action hint', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  writeFileSync(join(root, 'large.txt'), 'x'.repeat(20005));

  const result = readFileInsideRoot('large.txt', root);

  assert.match(result, /\[truncated at 20000 of 20005 chars\]/);
  assert.match(result, /"offset":20000/);
  assert.match(result, /\[ACTION:file:read\]/);
});

test('listFiles matches case-insensitive simple globs', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'CountrySelect.tsx'), '');

  assert.deepEqual(listFiles(root, '*countr*'), ['src/CountrySelect.tsx']);
});

test('listFiles accepts absolute patterns inside root', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'app.py'), '');

  assert.deepEqual(listFiles(root, join(root, '**', '*.py')), ['src/app.py']);
});

test('readFileInsideRoot rejects parent traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));

  assert.throws(() => readFileInsideRoot('../outside.txt', root), /outside allowed root/);
});
