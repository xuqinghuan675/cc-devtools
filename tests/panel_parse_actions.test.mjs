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
  const permissionModeEl = { ...emptyEl, value: 'auto' };
  const context = {
    clearTimeout() {},
    confirm: () => true,
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => selector === '#permission-mode-select' ? permissionModeEl : emptyEl,
    },
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
    __permissionModeEl: permissionModeEl,
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

test('plan mode blocks mutating and code-execution actions', async () => {
  const context = loadPanelContext();
  let executed = false;
  context.__permissionModeEl.value = 'plan';
  context.executeAction = async () => {
    executed = true;
    return 'ran';
  };

  await context.executeActions([{ type: 'click', code: 'button.save', placeholder: 'missing' }]);

  assert.equal(executed, false);
  assert.equal(context.__sentMessages.length, 1);
  assert.match(Object.values(context.__sentMessages[0].actionResults)[0], /blocked/i);
});

test('auto mode asks before eval and skips execution when declined', async () => {
  const context = loadPanelContext();
  let executed = false;
  context.confirm = () => false;
  context.executeAction = async () => {
    executed = true;
    return 'ran';
  };

  await context.executeActions([{ type: 'eval', code: 'localStorage.clear()', placeholder: 'missing' }]);

  assert.equal(executed, false);
  assert.equal(context.__sentMessages.length, 1);
  assert.match(Object.values(context.__sentMessages[0].actionResults)[0], /declined/i);
});

test('bypass mode executes high-risk actions without panel confirmation', async () => {
  const context = loadPanelContext();
  let executed = false;
  context.__permissionModeEl.value = 'bypassPermissions';
  context.confirm = () => {
    throw new Error('confirm should not be called');
  };
  context.executeAction = async () => {
    executed = true;
    return 'ran';
  };

  await context.executeActions([{ type: 'eval', code: 'location.href', placeholder: 'missing' }]);

  assert.equal(executed, true);
  assert.equal(Object.values(context.__sentMessages[0].actionResults)[0], 'ran');
});

test('redactSensitiveText hides token-like values but keeps useful context', () => {
  const { redactSensitiveText } = loadPanelContext();

  const result = redactSensitiveText('GET /api?token=abc123&country=SG Authorization: Bearer secret-value');

  assert.match(result, /token=\[redacted\]/);
  assert.match(result, /country=SG/);
  assert.match(result, /Authorization: Bearer \[redacted\]/);
  assert.ok(!result.includes('abc123'));
  assert.ok(!result.includes('secret-value'));
});
