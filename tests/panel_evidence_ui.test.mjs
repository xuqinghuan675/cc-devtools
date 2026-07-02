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

function loadEvidenceContext(options = {}) {
  const coreSource = readFileSync('cc_devtools/extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('cc_devtools/extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const sentMessages = [];
  const clipboardWrites = [];

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
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
  elements.get('#max-action-rounds').value = '5';
  elements.get('#evidence-type-filter').value = 'all';

  const context = {
    Array,
    clearTimeout() {},
    confirm: options.confirm || (() => true),
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
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
    __clipboardWrites: clipboardWrites,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  context.send = async (msg) => sentMessages.push(msg);
  return { context, elements, sentMessages, clipboardWrites };
}

test('Evidence page exposes filters, list, detail, and bottom actions', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="evidence"/);
  assert.match(html, /id="evidence-type-filter"/);
  assert.match(html, /id="evidence-search"/);
  assert.match(html, /id="evidence-list"/);
  assert.match(html, /id="evidence-detail"/);
  assert.match(html, /id="evidence-send-selected-btn"/);
  assert.match(html, /id="evidence-copy-selected-btn"/);
  assert.match(html, /id="evidence-clear-btn"/);
});

test('Evidence rendering uses text fields and keeps payload out of innerHTML', () => {
  const { context, elements } = loadEvidenceContext();

  context.addEvidenceItem({
    id: 'ev_xss',
    type: 'console',
    title: '<img src=x onerror=alert(1)>',
    summary: 'Authorization: Bearer secret-value',
    payload: { raw: '<script>alert(1)</script>' },
    selected: true,
  });

  context.selectEvidenceItem('ev_xss');

  assert.match(elements.get('#evidence-detail-title').textContent, /&lt;img/);
  assert.match(elements.get('#evidence-detail-summary').textContent, /Bearer \[redacted\]/);
  assert.match(elements.get('#evidence-detail-payload').textContent, /<script>alert\(1\)<\/script>/);
  assert.equal(elements.get('#evidence-detail-payload').innerHTML || '', '');
});

test('Copy selected evidence writes redacted markdown to clipboard', async () => {
  const { context, clipboardWrites } = loadEvidenceContext();

  context.addEvidenceItem({
    id: 'ev_copy',
    type: 'network',
    title: 'Network',
    summary: 'token=abc123',
    payload: { url: 'https://api.test/data?token=abc123&country=SG' },
    selected: true,
  });

  await context.copySelectedEvidence();

  assert.equal(clipboardWrites.length, 1);
  assert.match(clipboardWrites[0], /## Selected Evidence/);
  assert.match(clipboardWrites[0], /token=\[redacted\]/);
  assert.doesNotMatch(clipboardWrites[0], /abc123/);
});

test('Send selected evidence uses a normal user message and does not pass pageContext', async () => {
  const { context, sentMessages, elements } = loadEvidenceContext();

  context.addEvidenceItem({
    id: 'ev_send',
    type: 'file',
    title: 'File evidence',
    summary: 'src/App.jsx',
    payload: { path: 'src/App.jsx', content: 'export default 1;' },
    selected: true,
  });

  await context.sendSelectedEvidence();

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].content, /^Use only the selected evidence below/);
  assert.equal(Object.hasOwn(sentMessages[0], 'pageContext'), false);
  assert.match(elements.get('#evidence-send-summary').textContent, /Evidence: 1/);
  assert.match(elements.get('#evidence-send-summary').textContent, /File content: 1/);
});

test('Send selected evidence preview can block sending', async () => {
  const { context, sentMessages } = loadEvidenceContext({ confirm: () => false });

  context.addEvidenceItem({
    id: 'ev_blocked',
    type: 'console',
    title: 'Console',
    summary: 'Blocked send',
    selected: true,
  });

  await context.sendSelectedEvidence();

  assert.equal(sentMessages.length, 0);
});

