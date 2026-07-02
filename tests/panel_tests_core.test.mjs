import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

function evidence(overrides = {}) {
  return core.createEvidenceItem({
    id: overrides.id || 'ev_action',
    createdAt: '2026-07-02T00:00:00.000Z',
    type: overrides.type || 'verification',
    severity: 'info',
    source: 'action:click',
    title: overrides.title || 'Action evidence',
    summary: overrides.summary || 'Action result: Clicked: button[data-testid="save"]',
    payload: overrides.payload || {
      actionType: 'click',
      code: 'button[data-testid="save"]',
      result: 'Action result:\nClicked: button[data-testid="save"]\n\nVerification evidence:\nButtons: button Save',
    },
    selected: overrides.selected ?? true,
  });
}

test('selector confidence prioritizes stable semantic selectors and marks fragile CSS', () => {
  const testId = core.getSelectorConfidence('button[data-testid="save"]');
  assert.equal(testId.level, 'high');
  assert.equal(testId.strategy, 'testid');
  assert.match(testId.locator, /getByTestId\('save'\)/);

  const role = core.getSelectorConfidence('button[role="switch"]');
  assert.equal(role.level, 'high');
  assert.equal(role.strategy, 'role');

  const name = core.getSelectorConfidence('input[name="country"]');
  assert.equal(name.level, 'medium');
  assert.equal(name.strategy, 'name');

  const fragile = core.getSelectorConfidence('main > div:nth-child(3) > section > div:nth-child(2) > button:nth-child(5)');
  assert.equal(fragile.level, 'fragile');
  assert.equal(fragile.fragile, true);
});

test('GeneratedTestDraft emits Playwright skeleton from selected action evidence', () => {
  const draft = core.createGeneratedTestDraft({
    id: 'draft_1',
    createdAt: '2026-07-02T00:00:03.000Z',
    evidenceItems: [
      evidence({ id: 'ev_click' }),
      evidence({
        id: 'ev_fill',
        payload: {
          actionType: 'input',
          code: 'input[name="country"]\nSingapore',
          result: 'Input updated: input[name="country"]',
        },
      }),
      evidence({
        id: 'ev_press',
        payload: {
          actionType: 'press',
          code: 'Enter',
          result: 'Key dispatched: Enter',
        },
      }),
    ],
  });

  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.id, 'draft_1');
  assert.equal(draft.sourceBugBundleId, '');
  assert.deepEqual(draft.sourceEvidenceIds, ['ev_click', 'ev_fill', 'ev_press']);
  assert.match(draft.testCode, /import \{ test, expect \} from '@playwright\/test';/);
  assert.match(draft.testCode, /await page\.click\('button\[data-testid="save"\]'\);/);
  assert.match(draft.testCode, /await page\.fill\('input\[name="country"\]', 'Singapore'\);/);
  assert.match(draft.testCode, /await page\.press\('body', 'Enter'\);/);
  assert.ok(draft.assertions.some((assertion) => assertion.includes('Clicked')));
  assert.ok(draft.selectorConfidence.some((entry) => entry.selector === 'input[name="country"]'));
});

test('Playwright draft redacts sensitive values and email-like text', () => {
  const draft = core.createGeneratedTestDraft({
    evidenceItems: [
      evidence({
        id: 'ev_secret',
        summary: 'Authorization: Bearer secret-token user person@example.com',
        payload: {
          actionType: 'input',
          code: 'input[name="email"]\nperson@example.com',
          result: 'Input updated with token=abc123 and password=secret',
        },
      }),
    ],
  });

  assert.match(draft.testCode, /await page\.fill\('input\[name="email"\]', '\[redacted\]'\);/);
  assert.match(JSON.stringify(draft), /Bearer \[redacted\]/);
  assert.doesNotMatch(JSON.stringify(draft), /person@example\.com|abc123|secret-token|password=secret/);
});
