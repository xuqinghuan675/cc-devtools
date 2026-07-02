import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

test('RecorderEvent uses schemaVersion 1 and redacts input values without storing full value', () => {
  const event = core.createRecorderEvent({
    id: 'rec_input',
    createdAt: '2026-07-02T00:00:00.000Z',
    type: 'input',
    selector: 'input[name="email"]',
    value: 'person@example.com',
    pageUrl: 'https://app.test/login?token=abc123',
    pageTitle: 'Sign in',
  });

  assert.equal(event.schemaVersion, 1);
  assert.equal(event.id, 'rec_input');
  assert.equal(event.type, 'input');
  assert.equal(event.selector, 'input[name="email"]');
  assert.equal(event.valueSummary.length, 'person@example.com'.length);
  assert.equal(event.valueSummary.redacted, true);
  assert.equal(event.pageUrl, 'https://app.test/login?token=[redacted]');
  assert.doesNotMatch(JSON.stringify(event), /person@example\.com|abc123/);
});

test('Recorder ring buffer trims by time window, item count, and byte budget', () => {
  const store = core.createRecorderStore({
    maxItems: 3,
    maxBytes: 900,
    windowMs: 120000,
  });

  store.add(core.createRecorderEvent({ id: 'old', type: 'click', createdAt: '2026-07-02T00:00:00.000Z', selector: '#old' }));
  store.add(core.createRecorderEvent({ id: 'a', type: 'click', createdAt: '2026-07-02T00:02:01.000Z', selector: '#a' }));
  store.add(core.createRecorderEvent({ id: 'b', type: 'press', createdAt: '2026-07-02T00:02:02.000Z', key: 'Enter' }));
  store.add(core.createRecorderEvent({ id: 'c', type: 'route', createdAt: '2026-07-02T00:02:03.000Z', from: '/a', to: '/b' }));
  store.add(core.createRecorderEvent({ id: 'd', type: 'title', createdAt: '2026-07-02T00:02:04.000Z', from: 'A', to: 'B' }));

  assert.deepEqual(store.list().map((event) => event.id), ['b', 'c', 'd']);
  assert.equal(store.stats().count, 3);
  assert.ok(store.stats().byteEstimate <= 900);

  const byteStore = core.createRecorderStore({ maxItems: 10, maxBytes: 520, windowMs: 120000 });
  byteStore.add(core.createRecorderEvent({ id: 'small', type: 'click', createdAt: '2026-07-02T00:00:00.000Z', selector: '#small' }));
  byteStore.add(core.createRecorderEvent({ id: 'large', type: 'console', createdAt: '2026-07-02T00:00:01.000Z', summary: 'x'.repeat(600), evidenceId: 'ev_console' }));

  assert.deepEqual(byteStore.list().map((event) => event.id), ['large']);
});

test('Recorder console and network events keep only summaries and evidence ids', () => {
  const consoleEvent = core.createRecorderEvent({
    id: 'rec_console',
    type: 'console',
    summary: 'Error: failed with cookie=session123',
    evidenceId: 'ev_console_1',
    payload: { fullLog: 'cookie=session123 '.repeat(200) },
  });
  const networkEvent = core.createRecorderEvent({
    id: 'rec_network',
    type: 'network',
    summary: 'GET /api/users?api_key=abc123 -> 500',
    evidenceId: 'ev_network_1',
    payload: { response: 'secret body' },
  });

  assert.equal(consoleEvent.schemaVersion, 1);
  assert.equal(consoleEvent.evidenceId, 'ev_console_1');
  assert.equal(consoleEvent.payload, undefined);
  assert.doesNotMatch(JSON.stringify(consoleEvent), /session123|fullLog/);
  assert.equal(networkEvent.evidenceId, 'ev_network_1');
  assert.equal(networkEvent.payload, undefined);
  assert.doesNotMatch(JSON.stringify(networkEvent), /abc123|secret body|response/);
});

test('BugBundle has schemaVersion 1 and fixed GitHub issue markdown headings', () => {
  const events = [
    core.createRecorderEvent({ id: 'rec_click', type: 'click', createdAt: '2026-07-02T00:00:00.000Z', selector: 'button.save', pageUrl: 'https://app.test/edit', pageTitle: 'Editor' }),
    core.createRecorderEvent({ id: 'rec_input', type: 'input', createdAt: '2026-07-02T00:00:01.000Z', selector: 'input[name="title"]', value: 'Draft title' }),
    core.createRecorderEvent({ id: 'rec_console', type: 'console', createdAt: '2026-07-02T00:00:02.000Z', summary: 'TypeError: failed', evidenceId: 'ev_console' }),
    core.createRecorderEvent({ id: 'rec_network', type: 'network', createdAt: '2026-07-02T00:00:03.000Z', summary: 'POST /api/save -> 500', evidenceId: 'ev_network' }),
  ];

  const bundle = core.createBugBundle({
    id: 'bug_1',
    createdAt: '2026-07-02T00:00:04.000Z',
    title: 'Save fails',
    pageUrl: 'https://app.test/edit?session=abc123',
    pageTitle: 'Editor',
    events,
  });

  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.id, 'bug_1');
  assert.equal(bundle.pageUrl, 'https://app.test/edit?session=[redacted]');
  assert.deepEqual(bundle.evidenceIds, ['ev_console', 'ev_network']);
  assert.deepEqual(bundle.selectors, ['button.save', 'input[name="title"]']);
  assert.ok(bundle.reproductionSteps.some((step) => step.includes('button.save')));
  assert.equal(bundle.playwrightDraft, '');

  const headings = bundle.githubIssueMarkdown
    .split('\n')
    .filter((line) => line.startsWith('## '));
  assert.deepEqual(headings, [
    '## Symptom',
    '## Reproduction Steps',
    '## Expected',
    '## Actual',
    '## Console Evidence',
    '## Network Evidence',
    '## Suspected Area',
    '## Environment',
    '## Evidence IDs',
  ]);
  assert.doesNotMatch(bundle.githubIssueMarkdown, /abc123|Draft title/);
});
