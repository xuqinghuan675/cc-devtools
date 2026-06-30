import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadPanelContext() {
  const source = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = source.split('\nsendBtn.addEventListener')[0];
  const sentMessages = [];
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
  const context = {
    clearTimeout() {},
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: () => emptyEl,
    },
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
  };
  vm.createContext(context);
  vm.runInContext(definitionsOnly, context);
  context.send = (msg) => sentMessages.push(msg);
  return context;
}

test('parseActions escapes ordinary assistant HTML before rendering', () => {
  const { parseActions } = loadPanelContext();

  const parsed = parseActions('Before <img src=x onerror=alert(1)> after');

  assert.equal(parsed.actions.length, 0);
  assert.ok(parsed.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!parsed.html.includes('<img src=x'));
});

test('parseActions keeps action placeholders while escaping surrounding text', () => {
  const { parseActions } = loadPanelContext();

  const parsed = parseActions('<b>x</b>\n[ACTION:title][/ACTION]');

  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].type, 'title');
  assert.ok(parsed.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(parsed.html.includes('action-block'));
  assert.ok(!parsed.html.includes('<b>x</b>'));
});

test('parseActions supports interaction and project scan actions', () => {
  const { parseActions } = loadPanelContext();

  const parsed = parseActions([
    '[ACTION:click]button.save[/ACTION]',
    '[ACTION:input]input[name="country"]\nSingapore[/ACTION]',
    '[ACTION:press]Enter[/ACTION]',
    '[ACTION:project:scan][/ACTION]'
  ].join('\n'));

  assert.deepEqual(Array.from(parsed.actions, (action) => action.type), [
    'click',
    'input',
    'press',
    'project:scan'
  ]);
});

test('interaction actions serialize selectors inside inspected scripts', () => {
  const context = loadPanelContext();
  context.executeInspectedWindowEval = (code) => code;

  const script = context.executeClick('button[data-id="a\'b"]');

  assert.ok(script.includes('document.querySelector("button[data-id=\\"a\'b\\"]")'));
  assert.ok(script.includes('button[data-id=\\"a\'b\\"]'));
  assert.ok(!script.includes("return '已点击: button"));
});

test('executeActions stops after five automatic action result rounds', async () => {
  const context = loadPanelContext();
  context.executeAction = async () => 'ok';

  for (let i = 0; i < 6; i++) {
    await context.executeActions([{ type: 'title', code: '', placeholder: 'missing' }]);
  }

  assert.equal(context.__sentMessages.length, 5);
});
