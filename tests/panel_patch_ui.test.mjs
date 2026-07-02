import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function createElementStub() {
  const listeners = new Map();
  const children = [];
  const classes = new Set();
  return {
    children,
    dataset: {},
    disabled: false,
    hidden: false,
    style: {},
    textContent: '',
    value: '',
    className: '',
    innerHTML: '',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    replaceChildren(...nextChildren) {
      children.length = 0;
      children.push(...nextChildren);
    },
    focus() {},
    remove() {},
    setAttribute(name, value) {
      this[name] = String(value);
    },
    getAttribute(name) {
      return this[name] || '';
    },
    querySelectorAll() {
      return [];
    },
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const active = force === undefined ? !classes.has(name) : Boolean(force);
        if (active) classes.add(name);
        else classes.delete(name);
        return active;
      },
      contains: (name) => classes.has(name),
    },
    __listeners: listeners,
  };
}

function loadPatchContext(options = {}) {
  const coreSource = readFileSync('cc_devtools/extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('cc_devtools/extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const fileReads = [];
  const savedFiles = [];

  for (const selector of [
    '#messages',
    '#input',
    '#send-btn',
    '#status',
    '#page-info',
    '#token-usage',
    '#reset-btn',
    '#help-btn',
    '#help-panel',
    '#pick-btn',
    '#page-context-btn',
    '#workflow-select',
    '#permission-mode-select',
    '#max-action-rounds',
    '#bridge-token',
    '#save-token-btn',
    '#evidence-type-filter',
    '#evidence-search',
    '#evidence-list',
    '#evidence-detail',
    '#evidence-detail-title',
    '#evidence-detail-meta',
    '#evidence-detail-summary',
    '#evidence-detail-payload',
    '#evidence-send-summary',
    '#evidence-send-selected-btn',
    '#evidence-copy-selected-btn',
    '#evidence-clear-btn',
    '#recorder-status',
    '#recorder-event-count',
    '#recorder-byte-estimate',
    '#recorder-time-window',
    '#recorder-event-list',
    '#recorder-bundle-preview',
    '#recorder-pause-btn',
    '#recorder-resume-btn',
    '#recorder-pack-btn',
    '#recorder-copy-btn',
    '#recorder-clear-btn',
    '#tests-source-summary',
    '#tests-selector-confidence',
    '#tests-draft-preview',
    '#tests-generate-btn',
    '#tests-copy-btn',
    '#tests-clear-btn',
    '#patch-status',
    '#patch-hypothesis',
    '#patch-file-path',
    '#patch-proposed-content',
    '#patch-preview-btn',
    '#patch-apply-btn',
    '#patch-start-verify-btn',
    '#patch-verification-note',
    '#patch-mark-verified-btn',
    '#patch-rollback-btn',
    '#patch-diff-preview',
    '#patch-message',
    '#patch-session-json',
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = options.permissionMode || 'auto';
  elements.get('#max-action-rounds').value = '5';
  elements.get('#evidence-type-filter').value = 'all';

  const context = {
    Array,
    clearInterval() {},
    clearTimeout() {},
    confirm: () => true,
    console,
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      createElement: () => createElementStub(),
      getElementById: (id) => elements.get(`#${id}`) || createElementStub(),
      querySelector: (selector) => elements.get(selector) || createElementStub(),
      querySelectorAll: () => [],
    },
    navigator: { language: 'en-US', clipboard: { writeText() {} } },
    setInterval() {
      return 1;
    },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __fileReadResult: options.fileReadResult ?? 'before\n',
    __saveResults: [...(options.saveResults || [])],
    __fileReads: fileReads,
    __savedFiles: savedFiles,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  vm.runInContext(`
    executeFileAction = async function(type, payload) {
      __fileReads.push({ type, payload });
      return __fileReadResult;
    };
    executeSaveFile = async function(path, content) {
      __savedFiles.push({ path, content });
      return __saveResults.length ? __saveResults.shift() : 'File saved: ' + path;
    };
  `, context);
  context.initPatchBoard();
  return { context, elements, fileReads, savedFiles };
}

async function click(elements, selector) {
  const handler = elements.get(selector).__listeners.get('click');
  assert.equal(typeof handler, 'function', `${selector} click handler is registered`);
  await handler({ preventDefault() {} });
}

function fillPatchForm(elements, overrides = {}) {
  elements.get('#patch-hypothesis').value = overrides.hypothesis || 'Replace fixture content';
  elements.get('#patch-file-path').value = overrides.path || 'src/fixture.txt';
  elements.get('#patch-proposed-content').value = overrides.content ?? 'after\n';
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Patch tab exposes transaction controls', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="patch"/);
  for (const id of [
    'patch-status',
    'patch-hypothesis',
    'patch-file-path',
    'patch-proposed-content',
    'patch-preview-btn',
    'patch-apply-btn',
    'patch-start-verify-btn',
    'patch-verification-note',
    'patch-mark-verified-btn',
    'patch-rollback-btn',
    'patch-diff-preview',
    'patch-message',
    'patch-session-json',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('Patch preview reads the original file and does not write', async () => {
  const { elements, fileReads, savedFiles } = loadPatchContext({ fileReadResult: 'before\n' });
  fillPatchForm(elements);

  await click(elements, '#patch-preview-btn');

  assert.deepEqual(plain(fileReads), [{ type: 'file_read', payload: { path: 'src/fixture.txt', offset: 0, limit: 100000 } }]);
  assert.equal(savedFiles.length, 0);
  assert.match(elements.get('#patch-status').textContent, /preview/);
  assert.match(elements.get('#patch-diff-preview').textContent, /-before/);
  assert.match(elements.get('#patch-diff-preview').textContent, /\+after/);
  assert.equal(elements.get('#patch-diff-preview').innerHTML, '');
});

test('Patch apply writes proposed content through the file action path', async () => {
  const { elements, fileReads, savedFiles } = loadPatchContext({
    fileReadResult: 'before\n',
    saveResults: ['File saved: src/fixture.txt'],
  });
  fillPatchForm(elements);

  await click(elements, '#patch-preview-btn');
  await click(elements, '#patch-apply-btn');

  assert.equal(plain(fileReads).length, 2);
  assert.deepEqual(plain(savedFiles), [{ path: 'src/fixture.txt', content: 'after\n' }]);
  assert.match(elements.get('#patch-status').textContent, /applied/);
});

test('Patch rollback writes the backup through the file action path', async () => {
  const { elements, savedFiles } = loadPatchContext({
    fileReadResult: 'before\n',
    saveResults: ['Save failed: denied', 'File saved: src/fixture.txt'],
  });
  fillPatchForm(elements);

  await click(elements, '#patch-preview-btn');
  await click(elements, '#patch-apply-btn');
  await click(elements, '#patch-rollback-btn');

  assert.deepEqual(plain(savedFiles), [
    { path: 'src/fixture.txt', content: 'after\n' },
    { path: 'src/fixture.txt', content: 'before\n' },
  ]);
  assert.match(elements.get('#patch-status').textContent, /rolled_back/);
});

test('Patch rollback_failed remains visible when backup write fails', async () => {
  const { elements } = loadPatchContext({
    fileReadResult: 'before\n',
    saveResults: ['Save failed: denied', 'Save failed: denied again'],
  });
  fillPatchForm(elements);

  await click(elements, '#patch-preview-btn');
  await click(elements, '#patch-apply-btn');
  await click(elements, '#patch-rollback-btn');

  assert.match(elements.get('#patch-status').textContent, /rollback_failed/);
  assert.match(elements.get('#patch-message').textContent, /rollback_failed/);
});

test('Patch apply cannot claim applied when write permission is blocked', async () => {
  const { elements, savedFiles } = loadPatchContext({
    permissionMode: 'plan',
    fileReadResult: 'before\n',
  });
  fillPatchForm(elements);

  await click(elements, '#patch-preview-btn');
  await click(elements, '#patch-apply-btn');

  assert.equal(savedFiles.length, 0);
  assert.doesNotMatch(elements.get('#patch-status').textContent, /applied/);
  assert.match(elements.get('#patch-message').textContent, /write permission/i);
});
