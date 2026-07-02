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

function loadRecorderContext() {
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
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
  elements.get('#max-action-rounds').value = '5';
  elements.get('#evidence-type-filter').value = 'all';
  elements.get('#page-info').textContent = 'Editor';

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
    window: {
      __cc_pageUrl: 'https://app.test/edit?token=abc123',
      __cc_pageTitle: 'Editor',
    },
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
    __clipboardWrites: clipboardWrites,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  context.send = async (msg) => sentMessages.push(msg);
  context.initRecorderBoard();
  return { context, elements, sentMessages, clipboardWrites };
}

test('Recorder tab exposes status, counters, event list, bundle preview, and actions', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="recorder"/);
  assert.match(html, /id="recorder-status"/);
  assert.match(html, /id="recorder-event-count"/);
  assert.match(html, /id="recorder-byte-estimate"/);
  assert.match(html, /id="recorder-time-window"/);
  assert.match(html, /id="recorder-event-list"/);
  assert.match(html, /id="recorder-bundle-preview"/);
  assert.match(html, /id="recorder-pause-btn"/);
  assert.match(html, /id="recorder-resume-btn"/);
  assert.match(html, /id="recorder-pack-btn"/);
  assert.match(html, /id="recorder-copy-btn"/);
  assert.match(html, /id="recorder-clear-btn"/);
});

test('Recorder pause, resume, clear, pack, and copy never auto-send to the agent', async () => {
  const { context, elements, sentMessages, clipboardWrites } = loadRecorderContext();

  assert.equal(elements.get('#recorder-status').textContent, 'recording');

  elements.get('#recorder-pause-btn').__listeners.get('click')();
  assert.equal(elements.get('#recorder-status').textContent, 'paused');

  context.addRecorderEvent({ type: 'click', selector: 'button.save' });
  assert.equal(context.getRecorderEvents().length, 0);

  elements.get('#recorder-resume-btn').__listeners.get('click')();
  assert.equal(elements.get('#recorder-status').textContent, 'recording');

  context.addRecorderEvent({ type: 'click', selector: 'button.save', evidenceId: 'ev_click' });
  assert.equal(context.getRecorderEvents().length, 1);
  assert.equal(elements.get('#recorder-event-count').textContent, '1 events');
  assert.match(elements.get('#recorder-event-list').children[0].children[0].textContent, /button\.save/);

  await elements.get('#recorder-pack-btn').__listeners.get('click')();
  assert.match(elements.get('#recorder-bundle-preview').textContent, /"schemaVersion": 1/);
  assert.match(elements.get('#recorder-bundle-preview').textContent, /githubIssueMarkdown/);
  assert.equal(elements.get('#recorder-bundle-preview').innerHTML, '');

  await elements.get('#recorder-copy-btn').__listeners.get('click')();
  assert.equal(clipboardWrites.length, 1);
  assert.match(clipboardWrites[0], /"schemaVersion": 1/);
  assert.equal(sentMessages.length, 0);

  elements.get('#recorder-clear-btn').__listeners.get('click')();
  assert.equal(elements.get('#recorder-status').textContent, 'stopped');
  assert.equal(elements.get('#recorder-event-count').textContent, '0 events');
  assert.equal(elements.get('#recorder-bundle-preview').textContent, '');
});
