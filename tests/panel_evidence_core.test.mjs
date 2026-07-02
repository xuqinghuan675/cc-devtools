import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

function makeEvidence(overrides = {}) {
  return core.createEvidenceItem({
    id: overrides.id || `ev_${overrides.type || 'manual'}`,
    createdAt: overrides.createdAt || '2026-07-02T00:00:00.000Z',
    type: overrides.type || 'manual',
    severity: overrides.severity || 'info',
    source: overrides.source || overrides.type || 'manual',
    title: overrides.title || 'Evidence title',
    summary: overrides.summary || 'Evidence summary',
    payload: overrides.payload || {},
    selected: overrides.selected ?? true,
    tags: overrides.tags || [],
  });
}

test('Evidence helpers filter structured selected evidence by type and text', () => {
  const items = [
    makeEvidence({ id: 'ev_console', type: 'console', title: 'Console error', summary: 'Failed country fetch' }),
    makeEvidence({ id: 'ev_network', type: 'network', title: 'Network call', summary: 'GET /countries' }),
    makeEvidence({ id: 'ev_file', type: 'file', title: 'File content', summary: 'countries.json', selected: false }),
  ];

  assert.deepEqual(core.filterEvidenceItems(items, { type: 'console' }).map((item) => item.id), ['ev_console']);
  assert.deepEqual(core.filterEvidenceItems(items, { query: 'countries' }).map((item) => item.id), ['ev_network', 'ev_file']);
  assert.deepEqual(core.getSelectedEvidence(items).map((item) => item.id), ['ev_console', 'ev_network']);
});

test('Selected evidence summary counts types and estimates send size', () => {
  const items = [
    makeEvidence({ type: 'console', payload: { line: 'Error: failed' } }),
    makeEvidence({ type: 'network', payload: { url: '/api/countries' } }),
    makeEvidence({ type: 'file', payload: { path: 'countries.json', content: '[]' } }),
  ];

  const summary = core.summarizeSelectedEvidence(items);

  assert.equal(summary.evidenceCount, 3);
  assert.equal(summary.consoleCount, 1);
  assert.equal(summary.networkCount, 1);
  assert.equal(summary.fileContentCount, 1);
  assert.equal(summary.redactionEnabled, true);
  assert.ok(summary.estimatedTokens > 0);
});

test('Selected evidence message is redacted markdown and not page context', () => {
  const items = [
    makeEvidence({
      id: 'ev_secret',
      type: 'network',
      title: 'Request <script>alert(1)</script>',
      summary: 'Authorization: Bearer secret-value',
      payload: {
        url: 'https://api.test/users?token=abc123&country=SG',
        body: '{"password":"secret","country":"SG"}',
      },
    }),
  ];

  const message = core.buildSelectedEvidenceMessage(items);

  assert.match(message, /^Use only the selected evidence below unless you need to ask for more\./);
  assert.match(message, /## Selected Evidence/);
  assert.match(message, /ev_secret/);
  assert.match(message, /token=\[redacted\]/);
  assert.match(message, /password\\":\\"\[redacted\]/);
  assert.doesNotMatch(message, /abc123|secret-value|"secret"/);
  assert.doesNotMatch(message, /pageContext/);
});
