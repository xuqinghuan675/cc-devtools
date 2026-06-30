import { writeFileSync } from 'node:fs';

const seed = [
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'DE', name: 'Germany' }
];

writeFileSync(
  'public/cc-devtools/countries.json',
  `${JSON.stringify(seed, null, 2)}\n`,
  'utf8'
);

console.log('Reset public/cc-devtools/countries.json');
