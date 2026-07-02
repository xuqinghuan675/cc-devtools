import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const STALE_MESSAGE = 'Panel package copy is stale. Run: python scripts/sync_panel.py';
const PANEL_FILES = ['panel.html', 'panel.css', 'panel-core.js', 'panel-views.js', 'panel.js'];

test('packaged panel files are synchronized from extension/panel', () => {
  for (const file of PANEL_FILES) {
    const sourcePath = `extension/panel/${file}`;
    const packagedPath = `cc_devtools/extension/panel/${file}`;

    if (!existsSync(sourcePath) || !existsSync(packagedPath)) {
      assert.fail(STALE_MESSAGE);
    }

    const source = readFileSync(sourcePath, 'utf8');
    const packaged = readFileSync(packagedPath, 'utf8');

    if (source !== packaged) {
      assert.fail(STALE_MESSAGE);
    }
  }
});

