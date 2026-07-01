import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = join(repoRoot, 'docs', 'assets');
const outputPath = join(assetDir, 'frontend-loop-demo-animated.svg');
const sourcePath = join(assetDir, 'frontend-loop-demo-animated.svg');

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

function screenshotSvg({ title, eyebrow, rows, footer, accent }) {
  const rowText = rows.map((row, index) => (
    `<text x="54" y="${168 + index * 34}" class="row">${row}</text>`
  )).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${title}">
  <style>
    .bg { fill: #151617; }
    .chrome { fill: #202225; stroke: #363b42; stroke-width: 2; }
    .panel { fill: #101112; stroke: #30343a; stroke-width: 2; }
    .tab { fill: ${accent}; opacity: 0.18; }
    .accent { fill: ${accent}; }
    .muted { fill: #9aa4ae; font: 22px "Segoe UI", Arial, sans-serif; }
    .title { fill: #e8ecef; font: 700 38px "Segoe UI", Arial, sans-serif; }
    .small { fill: #c9d3dc; font: 18px "Segoe UI", Arial, sans-serif; }
    .row { fill: #e8ecef; font: 24px "Cascadia Code", Consolas, monospace; }
    .footer { fill: #73d99f; font: 700 24px "Segoe UI", Arial, sans-serif; }
  </style>
  <rect class="bg" width="960" height="540" rx="0"/>
  <rect class="chrome" x="28" y="28" width="904" height="484" rx="10"/>
  <rect class="tab" x="48" y="50" width="188" height="38" rx="6"/>
  <circle class="accent" cx="68" cy="69" r="6"/>
  <text x="88" y="76" class="small">cc-devtools</text>
  <text x="54" y="126" class="muted">${eyebrow}</text>
  <text x="54" y="92" class="title">${title}</text>
  <rect class="panel" x="42" y="140" width="876" height="270" rx="8"/>
${rowText}
  <rect x="42" y="430" width="876" height="54" rx="8" fill="#13241b" stroke="#2f6544" stroke-width="2"/>
  <text x="64" y="465" class="footer">${footer}</text>
</svg>
`;
}

const screenshotAssets = [
  {
    file: 'screenshot-connection-success.svg',
    title: 'Bridge connected',
    eyebrow: 'F12 panel status',
    rows: [
      'Status: Connected',
      'Workflow: Frontend Loop',
      'Token: saved in panel storage',
      'Write root: D:/project',
    ],
    footer: 'Local bridge is ready for evidence collection',
    accent: '#58c7b1',
  },
  {
    file: 'screenshot-network-error.svg',
    title: 'Network evidence',
    eyebrow: 'Network request detail',
    rows: [
      '#1 GET /api/countries -> 500',
      'Response Preview: Missing SG country row',
      'Initiator: app.js:42 loadCountries()',
      'Headers and token-like values redacted',
    ],
    footer: 'The agent can cite the failing request, not guess',
    accent: '#7aa7ff',
  },
  {
    file: 'screenshot-json-verified.svg',
    title: 'Local JSON patch',
    eyebrow: 'Frontend Loop result',
    rows: [
      'Read public/cc-devtools/countries.json',
      'Saved { code: "SG", name: "Singapore" }',
      'Selected Singapore in the live page',
      '#verification-output: Verified: Singapore',
    ],
    footer: 'Verified: Singapore',
    accent: '#73d99f',
  },
];

for (const asset of screenshotAssets) {
  const path = join(assetDir, asset.file);
  writeFileSync(path, screenshotSvg(asset), 'utf8');
  console.log(`Generated ${path}`);
}
