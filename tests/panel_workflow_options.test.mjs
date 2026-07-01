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
  const permissionModeSelect = emptyEl();
  permissionModeSelect.options = [
    { value: 'auto', textContent: 'Auto' },
    { value: 'plan', textContent: 'Plan' },
    { value: 'bypassPermissions', textContent: 'Bypass' },
  ];
  const maxActionRoundsInput = emptyEl();
  maxActionRoundsInput.value = '5';
  elements.set('#workflow-select', workflowSelect);
  elements.set('#permission-mode-select', permissionModeSelect);
  elements.set('#max-action-rounds', maxActionRoundsInput);
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
    '#workflow-control span',
    '#permission-mode-control span',
    '#action-rounds-control span',
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
  return { context, elements, workflowSelect, permissionModeSelect };
}

test('panel exposes the Frontend Loop workflow mode', () => {
  const html = readFileSync('cc_devtools/extension/panel/panel.html', 'utf8');
  const packagedHtml = readFileSync('extension/panel/panel.html', 'utf8');

  assert.match(html, /<option value="frontend-loop">Frontend Loop<\/option>/);
  assert.match(packagedHtml, /<option value="frontend-loop">Frontend Loop<\/option>/);
  assert.match(html, /<select id="permission-mode-select"/);
  assert.match(packagedHtml, /<select id="permission-mode-select"/);
  assert.match(html, /<input id="max-action-rounds"/);
  assert.match(packagedHtml, /<input id="max-action-rounds"/);
  assert.match(html, /id="token-usage"/);
  assert.match(packagedHtml, /id="token-usage"/);
  assert.match(html, /id="bridge-token"/);
  assert.match(packagedHtml, /id="bridge-token"/);
  assert.match(html, /id="save-token-btn"/);
  assert.match(packagedHtml, /id="save-token-btn"/);
  assert.match(html, /<button id="pick-btn"/);
  assert.match(packagedHtml, /<button id="pick-btn"/);
  assert.match(html, /\[ACTION:storage:list\]localStorage\[\/ACTION\]/);
  assert.match(html, /\[ACTION:network\]\{"id":1,"detail":true\}\[\/ACTION\]/);
  assert.match(html, /<option value="auto" selected>Auto<\/option>/);
  assert.match(html, /<option value="plan">Plan<\/option>/);
  assert.match(html, /<option value="bypassPermissions">Bypass<\/option>/);
});

test('panel localizes core controls for Chinese browsers', () => {
  const { elements, workflowSelect, permissionModeSelect } = loadLocalizedPanelContext('zh-CN');

  assert.equal(elements.get('#send-btn').textContent, '发送');
  assert.equal(elements.get('#page-context-btn').textContent, '收集');
  assert.equal(elements.get('#reset-btn').textContent, '重置');
  assert.equal(elements.get('#input').placeholder, '让 agent 检查、修改、点击或验证...');
  assert.equal(elements.get('#permission-mode-control span').textContent, '模式');
  assert.equal(workflowSelect.options.find((option) => option.value === 'inspect').textContent, '检查');
  assert.equal(
    workflowSelect.options.find((option) => option.value === 'local-data-patch').textContent,
    '本地数据修改',
  );
  assert.equal(permissionModeSelect.options.find((option) => option.value === 'auto').textContent, '自动');
  assert.equal(permissionModeSelect.options.find((option) => option.value === 'plan').textContent, '计划');
});
