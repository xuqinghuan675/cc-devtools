import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { scanFrontendProject } from '../bridge/project-scan.js';

test('scanFrontendProject detects React, Vite, scripts, and entry files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-devtools-'));
  writeFileSync(
    join(root, 'package.json'),
    '{"scripts":{"dev":"vite --host 0.0.0.0","test":"vitest"},"dependencies":{"react":"latest","vite":"latest"}}'
  );
  writeFileSync(join(root, 'vite.config.ts'), 'export default {}');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'App.tsx'), 'export function App() { return null }');
  mkdirSync(join(root, 'src', 'services'));
  writeFileSync(join(root, 'src', 'services', 'countryApi.ts'), 'export const countries = []');
  mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'public', 'countries.json'), '[]');

  const report = scanFrontendProject(root);

  assert.match(report, /Framework: React/);
  assert.match(report, /Bundler: Vite/);
  assert.match(report, /dev: vite --host 0\.0\.0\.0/);
  assert.match(report, /src\/App\.tsx/);
  assert.match(report, /vite\.config\.ts/);
  assert.match(report, /src\/services\/countryApi\.ts/);
  assert.match(report, /public\/countries\.json/);
});
