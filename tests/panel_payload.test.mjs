import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadPanelContext() {
  const source = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = source.split('\nsendBtn.addEventListener')[0];
  const emptyEl = {
    addEventListener() {},
    appendChild() {},
    classList: { add() {}, toggle() {} },
    focus() {},
    remove() {},
    scrollHeight: 0,
    style: {},
    textContent: '',
    value: '',
  };
  const workflowEl = { ...emptyEl, value: 'local-data-patch' };
  const context = {
    clearTimeout() {},
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => selector === '#workflow-select' ? workflowEl : { ...emptyEl },
    },
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
  };
  vm.createContext(context);
  vm.runInContext(definitionsOnly, context);
  return context;
}

test('buildChatPayload includes selected workflow', () => {
  const { buildChatPayload } = loadPanelContext();

  const payload = buildChatPayload({ content: 'debug the dropdown' });

  assert.equal(payload.workflow, 'local-data-patch');
  assert.equal(payload.content, 'debug the dropdown');
});
