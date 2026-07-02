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

function diagnosticResult(overrides = {}) {
  return {
    selector: 'button[data-testid="save"]',
    element: {
      tag: 'button',
      id: 'save',
      className: 'primary',
      text: 'Save',
      attributes: { type: 'button', 'data-testid': 'save' },
    },
    domSummary: 'button#save.primary Save',
    boundingClientRect: { x: 10, y: 20, width: 100, height: 32, top: 20, right: 110, bottom: 52, left: 10 },
    computedStyle: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto',
      zIndex: '12',
      position: 'relative',
      overflow: 'visible',
    },
    state: { disabled: false, ariaDisabled: false },
    viewport: { width: 1024, height: 768 },
    overflowClippingChain: [],
    clickableCenterPoint: { x: 60, y: 36, inViewport: true },
    topElementAtCenter: { tag: 'button', id: 'save', className: 'primary', matchesTarget: true, containsTarget: false },
    screenshotStatus: 'unsupported',
    ...overrides,
  };
}

function loadVisualContext(options = {}) {
  const coreSource = readFileSync('cc_devtools/extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('cc_devtools/extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const evalScripts = [];

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
    '#visual-selector',
    '#visual-diagnose-btn',
    '#visual-screenshot-status',
    '#visual-result-summary',
    '#visual-dom-summary',
    '#visual-rect',
    '#visual-computed-style',
    '#visual-clickability',
    '#visual-overflow-chain',
    '#visual-payload',
    '#visual-evidence-status',
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
    navigator: { language: 'en-US', clipboard: { writeText() {} } },
    setInterval() {
      return 1;
    },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __diagnosticResult: options.diagnosticResult || diagnosticResult(),
    __evalScripts: evalScripts,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  vm.runInContext(`
    executeInspectedWindowEval = async function(script) {
      __evalScripts.push(String(script));
      return __diagnosticResult;
    };
  `, context);
  context.initVisualBoard();
  return { context, elements, evalScripts };
}

async function click(elements, selector) {
  const handler = elements.get(selector).__listeners.get('click');
  assert.equal(typeof handler, 'function', `${selector} click handler is registered`);
  await handler({ preventDefault() {} });
}

test('Visual/DOM tab exposes selector diagnostics without screenshot requirements', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-tab="visual"/);
  assert.match(html, /data-workbench-panel="visual"/);
  for (const id of [
    'visual-selector',
    'visual-diagnose-btn',
    'visual-screenshot-status',
    'visual-result-summary',
    'visual-dom-summary',
    'visual-rect',
    'visual-computed-style',
    'visual-clickability',
    'visual-overflow-chain',
    'visual-payload',
    'visual-evidence-status',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('Visual/DOM diagnosis calls inspectedWindow eval, renders text, and records evidence', async () => {
  const { context, elements, evalScripts } = loadVisualContext();

  elements.get('#visual-selector').value = 'button[data-testid="save"]';
  await click(elements, '#visual-diagnose-btn');

  assert.equal(evalScripts.length, 1);
  assert.match(evalScripts[0], /querySelector/);
  assert.match(evalScripts[0], /button\[data-testid="save"\]/);
  assert.match(elements.get('#visual-result-summary').textContent, /clickable/);
  assert.match(elements.get('#visual-screenshot-status').textContent, /unsupported/);
  assert.match(elements.get('#visual-dom-summary').textContent, /button#save/);
  assert.match(elements.get('#visual-rect').textContent, /width/);
  assert.match(elements.get('#visual-computed-style').textContent, /pointerEvents/);
  assert.match(elements.get('#visual-clickability').textContent, /elementFromPoint/);
  assert.equal(elements.get('#visual-payload').innerHTML, '');

  const evidence = context.getEvidenceItems();
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].type, 'dom');
  assert.equal(evidence[0].selected, false);
  assert.equal(evidence[0].payload.diagnosticResult, 'clickable');
  assert.match(elements.get('#visual-evidence-status').textContent, /Evidence/);
});
