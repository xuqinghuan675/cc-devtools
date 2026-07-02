import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

test('Trust modes expose the full permission matrix', () => {
  assert.deepEqual(core.TRUST_MODES, ['observe', 'debug', 'patch']);

  const matrix = core.getTrustPermissionMatrix();
  assert.ok(matrix.some((row) => row.action === 'click/input/press'));
  assert.ok(matrix.some((row) => row.action === 'save/write'));

  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'title').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'click').decision, 'block');
  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'file:list').decision, 'block');
  assert.equal(core.canRunAction(core.createTrustPolicy('observe'), 'storage:get').decision, 'block');

  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'click').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'eval').decision, 'confirm');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'file:list').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'file:read').decision, 'confirm');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'save').decision, 'block');
  assert.equal(core.canRunAction(core.createTrustPolicy('debug'), 'storage:set').decision, 'confirm');

  assert.equal(core.canRunAction(core.createTrustPolicy('patch'), 'file:read').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('patch'), 'save').decision, 'allow');
  assert.equal(core.canRunAction(core.createTrustPolicy('patch'), 'storage:remove').decision, 'confirm');
});

test('Send preview summarizes redacted outgoing payloads', () => {
  const selectedEvidence = [
    core.createEvidenceItem({
      id: 'ev_console',
      type: 'console',
      title: 'Console',
      summary: 'Authorization: Bearer secret-token',
      payload: { message: 'token=abc123' },
      selected: true,
    }),
    core.createEvidenceItem({
      id: 'ev_file',
      type: 'file',
      title: 'File',
      summary: 'src/App.jsx',
      payload: { path: 'src/App.jsx', content: 'export default "ok";' },
      selected: true,
    }),
  ];

  const preview = core.createSendPreview({
    target: 'selected evidence',
    content: 'Please inspect ?token=abc123',
    selectedEvidence,
    pageContext: { url: 'https://app.test/?token=abc123' },
    actionResults: [{ type: 'title', result: 'Dashboard' }],
    policy: core.createTrustPolicy('debug'),
  });

  assert.equal(preview.schemaVersion, 1);
  assert.equal(preview.target, 'selected evidence');
  assert.equal(preview.evidenceCount, 2);
  assert.equal(preview.consoleCount, 1);
  assert.equal(preview.networkCount, 0);
  assert.equal(preview.fileContentCount, 1);
  assert.equal(preview.pageContextIncluded, true);
  assert.equal(preview.actionResultsIncluded, true);
  assert.equal(preview.redactionEnabled, true);
  assert.ok(preview.estimatedTokens > 0);
  assert.doesNotMatch(JSON.stringify(preview), /abc123|secret-token/);

  const summary = core.formatSendPreviewSummary(preview);
  assert.match(summary, /About to send:/);
  assert.match(summary, /Evidence: 2/);
  assert.match(summary, /Console: 1/);
  assert.match(summary, /File content: 1/);
  assert.match(summary, /Redaction: enabled/);
});
