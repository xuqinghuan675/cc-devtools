import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ENTRY_FILES = [
  'src/App.tsx',
  'src/App.jsx',
  'src/App.vue',
  'src/main.tsx',
  'src/main.jsx',
  'src/main.ts',
  'src/main.js',
  'src/pages/index.tsx',
  'src/app/page.tsx',
  'app/page.tsx',
  'pages/index.tsx',
  'src/index.tsx',
  'src/index.jsx',
  'index.html'
];

const CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'webpack.config.js',
  'webpack.config.ts',
  'tsconfig.json',
  'jsconfig.json',
  'tailwind.config.js',
  'postcss.config.js'
];

const KEY_DIRS = [
  'src',
  'app',
  'pages',
  'components',
  'src/components',
  'src/pages',
  'src/app',
  'src/routes',
  'src/router',
  'src/store',
  'src/stores',
  'src/services',
  'src/api',
  'src/lib',
  'public'
];

const PACKAGE_LOCKS = [
  ['pnpm', 'pnpm-lock.yaml'],
  ['yarn', 'yarn.lock'],
  ['npm', 'package-lock.json'],
  ['bun', 'bun.lockb']
];

const SCAN_IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '__pycache__']);
const DATA_HINT_TOKENS = ['api', 'service', 'services', 'data', 'store', 'mock', 'fixture', 'country', 'countries'];
const DATA_HINT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json']);
const MAX_DATA_HINTS = 40;
const MAX_SCAN_DEPTH = 6;

function readPackageJson(root) {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function deps(packageJson) {
  return {
    ...objectValue(packageJson.dependencies),
    ...objectValue(packageJson.devDependencies)
  };
}

function detectFramework(dependencies) {
  if (dependencies.next) return 'Next.js';
  if (dependencies.react) return 'React';
  if (dependencies.vue) return 'Vue';
  if (dependencies.svelte || dependencies['@sveltejs/kit']) return 'Svelte';
  if (dependencies['@angular/core']) return 'Angular';
  return 'Unknown';
}

function detectBundler(root, dependencies) {
  if (dependencies.vite || existsSync(join(root, 'vite.config.ts')) || existsSync(join(root, 'vite.config.js'))) return 'Vite';
  if (dependencies.next) return 'Next.js';
  if (dependencies.webpack || existsSync(join(root, 'webpack.config.js')) || existsSync(join(root, 'webpack.config.ts'))) return 'Webpack';
  if (dependencies.parcel) return 'Parcel';
  return 'Unknown';
}

function existingCandidates(root, candidates) {
  return candidates.filter((file) => existsSync(join(root, file)));
}

function detectPackageManager(root) {
  const match = PACKAGE_LOCKS.find(([, lockfile]) => existsSync(join(root, lockfile)));
  return match ? `${match[0]} (${match[1]})` : 'Unknown';
}

function extensionOf(file) {
  const index = file.lastIndexOf('.');
  return index === -1 ? '' : file.slice(index);
}

function collectDataHints(root) {
  const hints = [];
  const walk = (dir, relativeDir = '', depth = 0) => {
    if (hints.length >= MAX_DATA_HINTS || depth > MAX_SCAN_DEPTH) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (hints.length >= MAX_DATA_HINTS) return;

      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SCAN_IGNORE_DIRS.has(entry.name)) {
          walk(join(dir, entry.name), relative, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      const lower = relative.toLowerCase();
      if (!DATA_HINT_EXTENSIONS.has(extensionOf(lower))) continue;
      if (!DATA_HINT_TOKENS.some((token) => lower.includes(token))) continue;
      hints.push(relative);
    }
  };

  walk(root);
  return hints;
}

export function scanFrontendProject(root) {
  const base = resolve(root);
  const packageJson = readPackageJson(base);
  const dependencies = deps(packageJson);
  const scripts = objectValue(packageJson.scripts);
  const entryFiles = existingCandidates(base, ENTRY_FILES);
  const configFiles = existingCandidates(base, CONFIG_FILES);
  const keyDirs = existingCandidates(base, KEY_DIRS);
  const dataHints = collectDataHints(base);

  const lines = [
    '# Frontend Project Scan',
    `Root: ${base}`,
    `Framework: ${detectFramework(dependencies)}`,
    `Bundler: ${detectBundler(base, dependencies)}`,
    `Package Manager: ${detectPackageManager(base)}`,
    '',
    '## Scripts'
  ];

  const scriptEntries = Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b));
  if (scriptEntries.length) {
    lines.push(...scriptEntries.map(([name, cmd]) => `- ${name}: ${cmd}`));
  } else {
    lines.push('- (no package.json scripts found)');
  }

  lines.push('', '## Entry Files');
  if (entryFiles.length) {
    lines.push(...entryFiles.map((file) => `- ${file}`));
  } else {
    lines.push('- (no common frontend entry files found)');
  }

  lines.push('', '## Config Files');
  if (configFiles.length) {
    lines.push(...configFiles.map((file) => `- ${file}`));
  } else {
    lines.push('- (no common frontend config files found)');
  }

  lines.push('', '## Key Directories');
  if (keyDirs.length) {
    lines.push(...keyDirs.map((file) => `- ${file}`));
  } else {
    lines.push('- (no common frontend directories found)');
  }

  lines.push('', '## Data/Service Candidates');
  if (dataHints.length) {
    lines.push(...dataHints.map((file) => `- ${file}`));
  } else {
    lines.push('- (no obvious data, API, service, store, mock, or country files found)');
  }

  lines.push('', '## Dependencies');
  const interesting = Object.keys(dependencies)
    .sort()
    .filter((name) => ['react', 'vue', 'next', 'vite', 'webpack', 'svelte', '@sveltejs/kit', '@angular/core', 'typescript'].includes(name));
  if (interesting.length) {
    lines.push(...interesting.slice(0, 20).map((name) => `- ${name}: ${dependencies[name]}`));
  } else {
    lines.push('- (no frontend dependencies found)');
  }

  return lines.join('\n');
}
