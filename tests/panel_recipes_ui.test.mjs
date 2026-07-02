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

function createLocalStorageStub() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function loadRecipesContext() {
  const coreSource = readFileSync('extension/panel/panel-core.js', 'utf8');
  const viewsSource = readFileSync('extension/panel/panel-views.js', 'utf8');
  const panelSource = readFileSync('extension/panel/panel.js', 'utf8');
  const definitionsOnly = panelSource.split('\ninitWorkbenchTabs();')[0];
  const elements = new Map();
  const selectors = [
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
    '#recipes-list',
    '#recipes-count',
    '#recipe-name',
    '#recipe-description',
    '#recipe-tags',
    '#recipe-workflow',
    '#recipe-prompt-template',
    '#recipe-evidence-types',
    '#recipe-action-plan',
    '#recipe-save-btn',
    '#recipe-delete-btn',
    '#recipe-clear-btn',
    '#recipes-export-btn',
    '#recipes-import-btn',
    '#recipes-import-export',
    '#project-memory-count',
    '#project-memory-bucket',
    '#project-memory-entry',
    '#project-memory-list',
    '#project-memory-add-btn',
    '#project-memory-clear-bucket-btn',
    '#project-memory-export-btn',
    '#project-memory-import-btn',
    '#project-memory-import-export',
    '#recipes-message',
  ];
  for (const selector of selectors) {
    elements.set(selector, createElementStub());
  }
  elements.get('#permission-mode-select').value = 'auto';
  elements.get('#max-action-rounds').value = '5';
  elements.get('#project-memory-bucket').value = 'knownSelectors';

  const context = {
    Array,
    clearTimeout() {},
    console,
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      createElement: () => createElementStub(),
      getElementById: (id) => elements.get(`#${id}`) || createElementStub(),
      querySelector: (selector) => elements.get(selector) || createElementStub(),
      querySelectorAll: () => [],
    },
    localStorage: createLocalStorageStub(),
    navigator: { language: 'en-US', clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  vm.runInContext(viewsSource, context);
  vm.runInContext(definitionsOnly, context);
  context.initRecipesBoard();
  return { context, elements };
}

test('Recipes page exposes recipe and project memory controls', () => {
  const html = readFileSync('extension/panel/panel.html', 'utf8');

  assert.match(html, /data-workbench-panel="recipes"/);
  assert.match(html, /id="recipes-list"/);
  assert.match(html, /id="recipe-save-btn"/);
  assert.match(html, /id="recipes-import-export"/);
  assert.match(html, /id="project-memory-bucket"/);
  assert.match(html, /id="project-memory-add-btn"/);
  assert.match(html, /id="project-memory-import-export"/);
});

test('Recipes UI saves, exports, imports, and keeps memory bucket content separate', () => {
  const { elements } = loadRecipesContext();

  elements.get('#recipe-name').value = 'Login smoke';
  elements.get('#recipe-description').value = 'Check login';
  elements.get('#recipe-tags').value = 'auth, smoke';
  elements.get('#recipe-workflow').value = 'qa';
  elements.get('#recipe-prompt-template').value = 'Inspect login';
  elements.get('#recipe-evidence-types').value = 'console, network';
  elements.get('#recipe-action-plan').value = 'Open /login\nAssert dashboard';
  elements.get('#recipe-save-btn').__listeners.get('click')();

  assert.match(elements.get('#recipes-count').textContent, /1 recipe/);
  assert.equal(elements.get('#recipes-list').children.length, 1);

  elements.get('#recipes-export-btn').__listeners.get('click')();
  assert.match(elements.get('#recipes-import-export').value, /Login smoke/);

  elements.get('#recipes-import-export').value = '{bad json';
  elements.get('#recipes-import-btn').__listeners.get('click')();
  assert.match(elements.get('#recipes-message').textContent, /Import failed/);

  elements.get('#project-memory-bucket').value = 'knownSelectors';
  elements.get('#project-memory-entry').value = 'button[data-testid="save"]';
  elements.get('#project-memory-add-btn').__listeners.get('click')();

  elements.get('#project-memory-bucket').value = 'apiContracts';
  elements.get('#project-memory-entry').value = 'GET /api/users';
  elements.get('#project-memory-add-btn').__listeners.get('click')();

  elements.get('#project-memory-bucket').value = 'knownSelectors';
  elements.get('#project-memory-bucket').__listeners.get('change')();

  assert.match(elements.get('#project-memory-count').textContent, /2 memory item/);
  assert.equal(elements.get('#project-memory-list').children.length, 1);
  assert.match(elements.get('#project-memory-list').children[0].textContent, /button\[data-testid="save"\]/);
});
