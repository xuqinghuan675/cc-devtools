import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('panel exposes the Frontend Loop workflow mode', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');
  const packagedHtml = readFileSync('extension/panel/panel.html', 'utf8');

  assert.match(html, /<option value="frontend-loop">Frontend Loop<\/option>/);
  assert.match(packagedHtml, /<option value="frontend-loop">Frontend Loop<\/option>/);
});
