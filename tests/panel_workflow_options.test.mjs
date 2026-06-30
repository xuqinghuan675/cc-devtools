import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadLocalizedPanelContext(language = 'zh-CN') {
  const source = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = source.split('\nsendBtn.addEventListener')[0];
  const elements = new Map();
  const emptyEl = () => ({
    addEventListener() {},
    appendChild() {},
    classList: { add() {}, toggle() {} },
    focus() {},
    remove() {},
    scrollHeight: 0,
    style: {},
    textContent: '',
    title: '',
    value: '',
  });
  const workflowSelect = emptyEl();
  workflowSelect.options = [
    { value: 'inspect', textContent: 'Inspect' },
    { value: 'debug', textContent: 'Debug' },
    { value: 'selector', textContent: 'Selector' },
    { value: 'qa', textContent: 'QA' },
    { value: 'local-data-patch', textContent: 'Local Data Patch' },
    { value: 'frontend-loop', textContent: 'Frontend Loop' },
  ];
  elements.set('#workflow-select', workflowSelect);
  for (const selector of [
    '#messages',
    '#input',
    '#send-btn',
    '#status',
    '#page-info',
    '#reset-btn',
    '#help-btn',
    '#help-panel',
    '#page-context-btn',
    '#workflow-control span',
    '.help-title',
  ]) {
    if (!elements.has(selector)) elements.set(selector, emptyEl());
  }
  elements.get('#status').textContent = 'Disconnected';

  const context = {
    Array,
    clearTimeout() {},
    console,
    document: {
      documentElement: { classList: { toggle() {} }, lang: '' },
      createElement: () => emptyEl(),
      getElementById: () => emptyEl(),
      querySelector: (selector) => elements.get(selector) || emptyEl(),
    },
    navigator: { language },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
  };
  vm.createContext(context);
  vm.runInContext(definitionsOnly, context);
  return { context, elements, workflowSelect };
}

test('panel exposes the Frontend Loop workflow mode', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');
  const packagedHtml = readFileSync('extension/panel/panel.html', 'utf8');

  assert.match(html, /<option value="frontend-loop">Frontend Loop<\/option>/);
  assert.match(packagedHtml, /<option value="frontend-loop">Frontend Loop<\/option>/);
});

test('panel localizes core controls for Chinese browsers', () => {
  const { elements, workflowSelect } = loadLocalizedPanelContext('zh-CN');

  assert.equal(elements.get('#send-btn').textContent, '发送');
  assert.equal(elements.get('#page-context-btn').textContent, '收集');
  assert.equal(elements.get('#reset-btn').textContent, '重置');
  assert.equal(elements.get('#input').placeholder, '让 agent 检查、修改、点击或验证...');
  assert.equal(workflowSelect.options.find((option) => option.value === 'inspect').textContent, '检查');
  assert.equal(
    workflowSelect.options.find((option) => option.value === 'local-data-patch').textContent,
    '本地数据修改',
  );
});
