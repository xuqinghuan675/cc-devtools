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

function loadTrustContext(options = {}) {
  const coreSource = readFileSync('extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const confirms = [];
  const sentMessages = [];

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
    '#trust-mode-select',
    '#trust-policy-summary',
    '#trust-permission-matrix',
    '#trust-send-preview',
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
  elements.get('#trust-mode-select').value = options.mode || 'debug';
  elements.get('#max-action-rounds').value = '5';

  const context = {
    Array,
    clearTimeout() {},
    confirm: (message) => {
      confirms.push(message);
      return options.confirmResult !== false;
    },
    console,
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      createElement: () => createElementStub(),
      getElementById: (id) => elements.get(`#${id}`) || createElementStub(),
      querySelector: (selector) => elements.get(selector) || createElementStub(),
      querySelectorAll: () => [],
    },
    navigator: { language: 'en-US', clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  context.send = async (msg) => sentMessages.push(msg);
  context.initTrustBoard();
  return { context, elements, confirms, sentMessages };
}

test('Trust page exposes mode selector, matrix, and send preview surface', () => {
  const html = readFileSync('extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="trust"/);
  assert.match(html, /id="trust-mode-select"/);
  assert.match(html, /value="observe"/);
  assert.match(html, /value="debug"/);
  assert.match(html, /value="patch"/);
  assert.match(html, /id="trust-permission-matrix"/);
  assert.match(html, /id="trust-send-preview"/);
});

test('Trust UI mode drives actionPolicy and shared send preview', () => {
  const { context, elements, confirms } = loadTrustContext({ mode: 'debug' });

  assert.equal(context.actionPolicy('save'), 'block');
  assert.equal(context.actionPolicy('file:read'), 'confirm');

  elements.get('#trust-mode-select').value = 'patch';
  elements.get('#trust-mode-select').__listeners.get('change')();

  assert.equal(context.actionPolicy('save'), 'allow');
  assert.ok(elements.get('#trust-permission-matrix').children.length > 0);

  const preview = context.buildSendPreview({
    target: 'chat',
    content: 'Inspect token=abc123',
    selectedEvidence: [
      context.createEvidence({ type: 'network', title: 'Request', summary: 'token=abc123', selected: true }),
    ],
  });

  assert.equal(context.confirmSendPreview(preview), true);
  assert.match(elements.get('#trust-send-preview').textContent, /About to send:/);
  assert.match(elements.get('#trust-send-preview').textContent, /Network: 1/);
  assert.doesNotMatch(elements.get('#trust-send-preview').textContent, /abc123/);
  assert.equal(confirms.length, 1);
});

test('Debug Safe blocks save with Patch Sandbox guidance instead of plan-mode wording', async () => {
  const { context } = loadTrustContext({ mode: 'debug' });
  let executed = false;
  context.executeAction = async () => {
    executed = true;
    return 'wrote file';
  };

  await context.executeActions([{ type: 'save', code: 'src/App.jsx\nnext', placeholder: 'missing' }]);

  assert.equal(executed, false);
  const result = Object.values(context.__sentMessages[0].actionResults)[0];
  assert.match(result, /File write blocked by Debug Safe/);
  assert.match(result, /Switch Trust Mode to Patch Sandbox/);
  assert.doesNotMatch(result, /Plan mode/i);
});
