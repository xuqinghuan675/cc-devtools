import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getWorkflowPrompt } from '../bridge/workflows.js';

test('known workflow is loaded', () => {
  const prompt = getWorkflowPrompt('local-data-patch');

  assert.match(prompt, /Local Data Patch/);
  assert.match(prompt, /country/i);
});

test('frontend loop workflow is loaded', () => {
  const prompt = getWorkflowPrompt('frontend-loop');

  assert.match(prompt, /Frontend Loop/);
  assert.match(prompt, /\[ACTION:project:scan\]\[\/ACTION\]/);
  assert.match(prompt, /\[ACTION:click\]/);
  assert.match(prompt, /Singapore/);
});

test('unknown workflow falls back to inspect', () => {
  const prompt = getWorkflowPrompt('not-real');

  assert.match(prompt, /Inspect/);
  assert.doesNotMatch(prompt, /not-real/);
});
