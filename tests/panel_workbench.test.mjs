import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function createElementStub() {
  const classes = new Set();
  const listeners = new Map();
  return {
    children: [],
    dataset: {},
    hidden: false,
    style: {},
    textContent: '',
    value: '',
    className: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
      contains: (name) => classes.has(name),
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    focus() {},
    remove() {},
    getAttribute(name) {
      if (name === 'data-tab') return this.dataset.tab;
      return undefined;
    },
    __listeners: listeners,
  };
}

function loadPanelWorkbenchContext() {
  const coreSource = readFileSync('cc_devtools/extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('cc_devtools/extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitBridgeTokenControl();')[0];
  const elements = new Map();
  const tabNames = ['chat', 'evidence', 'recorder', 'patch', 'tests', 'trust', 'recipes'];
  const tabButtons = tabNames.map((name) => {
    const el = createElementStub();
    el.dataset.tab = name;
    return el;
  });
  const tabPanels = tabNames.map((name) => {
    const el = createElementStub();
    el.dataset.tabPanel = name;
    return el;
  });

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
  ]) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
  elements.get('#max-action-rounds').value = '5';

  const context = {
    Array,
    clearTimeout() {},
    console,
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      createElement: () => createElementStub(),
      getElementById: (id) => elements.get(`#${id}`) || createElementStub(),
      querySelector: (selector) => elements.get(selector) || createElementStub(),
      querySelectorAll: (selector) => {
        if (selector === '[data-workbench-tab]') return tabButtons;
        if (selector === '[data-workbench-panel]') return tabPanels;
        return [];
      },
    },
    navigator: { language: 'en-US', clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  return { context, elements, tabButtons, tabPanels };
}

test('panel exposes Workbench tabs while keeping Chat as the default page', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');

  for (const tab of ['chat', 'evidence', 'recorder', 'patch', 'tests', 'trust', 'recipes']) {
    assert.match(html, new RegExp(`data-workbench-tab="${tab}"`));
    assert.match(html, new RegExp(`data-workbench-panel="${tab}"`));
  }

  assert.match(html, /<script src="panel-core\.js"><\/script>\s*<script src="panel-views\.js"><\/script>\s*<script src="panel\.js"><\/script>/);
  assert.match(html, /data-workbench-panel="chat"[\s\S]*id="messages"[\s\S]*id="input-container"/);
});

test('switching Workbench tabs does not remove Chat messages', () => {
  const { context, elements, tabPanels } = loadPanelWorkbenchContext();
  const messagesEl = elements.get('#messages');

  messagesEl.appendChild({ textContent: 'Keep this conversation' });

  context.activateWorkbenchTab('evidence');
  context.activateWorkbenchTab('chat');

  assert.equal(messagesEl.children.length, 1);
  assert.equal(messagesEl.children[0].textContent, 'Keep this conversation');
  assert.equal(tabPanels.find((panel) => panel.dataset.tabPanel === 'chat').hidden, false);
});

