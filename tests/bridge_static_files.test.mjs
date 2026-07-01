import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';

import { readStaticFileRequest } from '../bridge/static-files.js';

function request(url, headers = {}) {
  return { url, headers };
}

test('static file reads require the configured bridge token', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-root-'));
  writeFileSync(join(root, 'public.txt'), 'ok');

  const result = readStaticFileRequest(
    request('/files/public.txt'),
    root,
    { CC_DEVTOOLS_TOKEN: 'secret' },
  );

  assert.equal(result.status, 401);
});

test('static file reads accept the bridge token from headers', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-root-'));
  writeFileSync(join(root, 'public.txt'), 'ok');

  const result = readStaticFileRequest(
    request('/files/public.txt', { 'x-cc-devtools-token': 'secret' }),
    root,
    { CC_DEVTOOLS_TOKEN: 'secret' },
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.toString('utf8'), 'ok');
  assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
});

test('static file reads reject sensitive files inside the root', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-root-'));
  writeFileSync(join(root, '.env'), 'TOKEN=secret');

  const result = readStaticFileRequest(
    request('/files/.env', { 'x-cc-devtools-token': 'secret' }),
    root,
    { CC_DEVTOOLS_TOKEN: 'secret' },
  );

  assert.equal(result.status, 403);
});

test('static file reads reject sibling-prefix traversal outside the root', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-root-'));
  const sibling = `${root}-outside`;
  mkdirSync(sibling);
  writeFileSync(join(sibling, 'secret.txt'), 'outside');

  const result = readStaticFileRequest(
    request(`/files/../${basename(sibling)}/secret.txt`, { 'x-cc-devtools-token': 'secret' }),
    root,
    { CC_DEVTOOLS_TOKEN: 'secret' },
  );

  assert.equal(result.status, 403);
});
