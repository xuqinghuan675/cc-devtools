import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

test('createEvidenceItem adds schema metadata, escaping, and redaction', () => {
  const item = core.createEvidenceItem({
    pageUrl: 'https://app.test/users?token=abc123&country=SG',
    pageTitle: 'Users <Admin>',
    type: 'console',
    severity: 'error',
    source: 'console',
    title: 'Load <failed>',
    summary: 'Authorization: Bearer secret-value',
    payload: {
      request: 'GET /users?api_key=abc123&country=SG',
      body: '{"password":"secret","country":"SG"}',
    },
    selected: true,
    tags: ['network', 'auth'],
  });

  assert.equal(item.schemaVersion, 1);
  assert.ok(item.id);
  assert.match(item.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(item.pageUrl, 'https://app.test/users?token=[redacted]&country=SG');
  assert.equal(item.pageTitle, 'Users &lt;Admin&gt;');
  assert.equal(item.title, 'Load &lt;failed&gt;');
  assert.equal(item.summary, 'Authorization: Bearer [redacted]');
  assert.equal(item.payload.request, 'GET /users?api_key=[redacted]&country=SG');
  assert.equal(item.payload.body, '{"password":"[redacted]","country":"SG"}');
  assert.equal(item.redacted, true);
  assert.equal(item.selected, true);
});

test('TrustPolicy supports new workbench modes and legacy action modes', () => {
  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'title').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'click').decision, 'block');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'file:read').decision, 'confirm');
  assert.equal(core.canRunAction(core.createTrustPolicy('patch'), 'save').decision, 'allow');

  assert.equal(core.canRunAction(core.createTrustPolicy('plan'), 'storage:get').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('plan'), 'storage:set').decision, 'block');
  assert.equal(core.canRunAction(core.createTrustPolicy('auto'), 'eval').decision, 'confirm');
  assert.equal(core.canRunAction(core.createTrustPolicy('bypassPermissions'), 'eval').decision, 'allow');
});

test('createStore enforces item and byte budgets by dropping oldest items', () => {
  const store = core.createStore({ maxItems: 2, maxBytes: 1000 });

  store.add({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z', title: 'old', payload: 'x'.repeat(40) });
  store.add({ id: 'middle', createdAt: '2026-01-01T00:00:01.000Z', title: 'middle', payload: 'x'.repeat(40) });
  store.add({ id: 'new', createdAt: '2026-01-01T00:00:02.000Z', title: 'new', payload: 'x'.repeat(40) });

  assert.deepEqual(store.list().map((item) => item.id), ['middle', 'new']);

  const byteBudgetedStore = core.createStore({ maxItems: 5, maxBytes: 240 });
  byteBudgetedStore.add({ id: 'small', createdAt: '2026-01-01T00:00:00.000Z', title: 'small', payload: 'x'.repeat(40) });
  byteBudgetedStore.add({ id: 'large', createdAt: '2026-01-01T00:00:01.000Z', title: 'large', payload: 'x'.repeat(500) });

  assert.deepEqual(byteBudgetedStore.list().map((item) => item.id), ['large']);
});
