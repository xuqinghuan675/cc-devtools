import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repoRoot, 'docs', 'assets', 'frontend-loop-demo-animated.svg');
const sourcePath = join(repoRoot, 'docs', 'assets', 'frontend-loop-demo-animated.svg');

const svg = readFileSync(sourcePath, 'utf8');
const requiredPhrases = [
  'Step 1: F12 chat',
  'Step 2: Project scan',
  'Step 3: Write local JSON',
  'Step 4: Browser verification',
  'Verified: Singapore'
];

for (const phrase of requiredPhrases) {
  if (!svg.includes(phrase)) {
    throw new Error(`Demo asset is missing phrase: ${phrase}`);
  }
}

if (!svg.includes('<animate')) {
  throw new Error('Demo asset is missing SVG animation tags.');
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, svg, 'utf8');
console.log(`Generated ${outputPath}`);
