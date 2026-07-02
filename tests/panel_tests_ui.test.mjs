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

function loadTestsContext() {
  const coreSource = readFileSync('cc_devtools/extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('cc_devtools/extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const sentMessages = [];
  const clipboardWrites = [];
  const fileWrites = [];

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
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
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
    navigator: {
      language: 'en-US',
      clipboard: {
        writeText: async (text) => clipboardWrites.push(text),
      },
    },
    setInterval() {
      return 1;
    },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
    __clipboardWrites: clipboardWrites,
    __fileWrites: fileWrites,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  context.send = async (msg) => sentMessages.push(msg);
  context.executeSaveFile = async (...args) => fileWrites.push(args);
  context.initTestsBoard();
  return { context, elements, sentMessages, clipboardWrites, fileWrites };
}

test('Tests tab exposes a selected-evidence generator and copy-only preview', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="tests"/);
  assert.match(html, /id="tests-source-summary"/);
  assert.match(html, /id="tests-selector-confidence"/);
  assert.match(html, /id="tests-draft-preview"/);
  assert.match(html, /id="tests-generate-btn"/);
  assert.match(html, /id="tests-copy-btn"/);
  assert.match(html, /id="tests-clear-btn"/);
});

test('Tests tab generates a Playwright draft from selected evidence and copies only', async () => {
  const { context, elements, sentMessages, clipboardWrites, fileWrites } = loadTestsContext();

  context.addEvidenceItem({
    id: 'ev_click',
    type: 'verification',
    title: 'Click save',
    summary: 'Action result: Clicked save',
    payload: {
      actionType: 'click',
      code: 'button[data-testid="save"]',
      result: 'Clicked: button[data-testid="save"]',
    },
    selected: true,
  });
  context.addEvidenceItem({
    id: 'ev_unselected',
    type: 'verification',
    title: 'Ignore me',
    payload: { actionType: 'press', code: 'Escape', result: 'ignored' },
    selected: false,
  });

  elements.get('#tests-generate-btn').__listeners.get('click')();

  assert.match(elements.get('#tests-source-summary').textContent, /Selected evidence: 1/);
  assert.match(elements.get('#tests-draft-preview').textContent, /await page\.click\('button\[data-testid="save"\]'\);/);
  assert.equal(elements.get('#tests-draft-preview').innerHTML, '');
  assert.match(elements.get('#tests-selector-confidence').children[0].children[0].textContent, /high/);

  await elements.get('#tests-copy-btn').__listeners.get('click')();

  assert.equal(clipboardWrites.length, 1);
  assert.match(clipboardWrites[0], /schemaVersion/);
  assert.match(clipboardWrites[0], /testCode/);
  assert.equal(sentMessages.length, 0);
  assert.equal(fileWrites.length, 0);
});

test('Tests tab clear removes only the generated draft preview', () => {
  const { context, elements } = loadTestsContext();

  context.addEvidenceItem({
    id: 'ev_press',
    type: 'verification',
    title: 'Press Enter',
    payload: { actionType: 'press', code: 'Enter', result: 'Key dispatched: Enter' },
    selected: true,
  });

  elements.get('#tests-generate-btn').__listeners.get('click')();
  assert.match(elements.get('#tests-draft-preview').textContent, /page\.press/);

  elements.get('#tests-clear-btn').__listeners.get('click')();
  assert.equal(elements.get('#tests-draft-preview').textContent, '');
  assert.equal(elements.get('#tests-selector-confidence').children.length, 0);
});
