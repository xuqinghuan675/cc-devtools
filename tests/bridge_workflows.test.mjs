import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getWorkflowPrompt } from '../bridge/workflows.js';

test('known workflow is loaded', () => {
  const prompt = getWorkflowPrompt('local-data-patch');

  assert.match(prompt, /Local Data Patch/);
  assert.match(prompt, /country/i);
});

test('unknown workflow falls back to inspect', () => {
  const prompt = getWorkflowPrompt('not-real');

  assert.match(prompt, /Inspect/);
  assert.doesNotMatch(prompt, /not-real/);
});
