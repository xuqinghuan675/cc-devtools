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
  const maxActionRoundsEl = { ...emptyEl, value: '5' };
  const context = {
    clearTimeout() {},
    confirm: () => true,
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => {
        if (selector === '#permission-mode-select') return permissionModeEl;
        if (selector === '#max-action-rounds') return maxActionRoundsEl;
        return emptyEl;
      },
    },
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
    __sentMessages: sentMessages,
    __permissionModeEl: permissionModeEl,
    __maxActionRoundsEl: maxActionRoundsEl,
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
    '[ACTION:project:scan][/ACTION]',
    '[ACTION:storage:list]localStorage[/ACTION]',
    '[ACTION:storage:get]{"area":"localStorage","key":"theme"}[/ACTION]',
    '[ACTION:storage:set]{"area":"sessionStorage","key":"debug","value":"1"}[/ACTION]',
    '[ACTION:storage:remove]{"area":"cookie","key":"debug"}[/ACTION]'
  ].join('\n'));

  assert.deepEqual(Array.from(parsed.actions, (action) => action.type), [
    'click',
    'input',
    'press',
    'project:scan',
    'storage:list',
    'storage:get',
    'storage:set',
    'storage:remove'
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

test('executeActions uses the configured automatic action round limit', async () => {
  const context = loadPanelContext();
  context.__maxActionRoundsEl.value = '7';
  context.executeAction = async () => 'ok';

  for (let i = 0; i < 8; i++) {
    await context.executeActions([{ type: 'title', code: '', placeholder: 'missing' }]);
  }

  assert.equal(context.__sentMessages.length, 7);
});

test('executeActions attaches verification evidence to action results', async () => {
  const context = loadPanelContext();
  const snapshots = [
    { url: 'http://localhost/before', title: 'Before', textSample: 'idle', active: 'body' },
    {
      url: 'http://localhost/app/cf2ccf0d2c768f09',
      title: 'After',
      textSample: 'Gemini replied: received',
      active: 'textarea#prompt value="received"',
      inputs: ['textarea#prompt value="received"'],
      buttons: ['button Send'],
    },
  ];
  context.collectActionEvidence = async () => snapshots.shift();
  context.executeAction = async () => 'Clicked: button.send';

  await context.executeActions([{ type: 'click', code: 'button.send', placeholder: 'missing' }]);

  const result = Object.values(context.__sentMessages[0].actionResults)[0];
  assert.match(result, /Action result:/);
  assert.match(result, /Verification evidence:/);
  assert.match(result, /URL: http:\/\/localhost\/before -> http:\/\/localhost\/app\/cf2ccf0d2c768f09/);
  assert.match(result, /Text changed: yes/);
  assert.match(result, /button Send/);
});

test('executeInput script uses native value setters and avoids innerHTML injection', () => {
  const context = loadPanelContext();
  context.executeInspectedWindowEval = (code) => code;

  const script = context.executeInput('[contenteditable="true"]', '<b>hello</b>');

  assert.match(script, /HTMLInputElement\.prototype/);
  assert.match(script, /HTMLTextAreaElement\.prototype/);
  assert.match(script, /InputEvent/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
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

test('copy action prepares manual copy without writing clipboard automatically', async () => {
  const context = loadPanelContext();
  let clipboardWrites = 0;
  context.navigator.clipboard.writeText = () => {
    clipboardWrites += 1;
  };

  await context.executeActions([{ type: 'copy', code: 'copy me', placeholder: 'missing' }]);

  assert.equal(clipboardWrites, 0);
  assert.equal(context.__sentMessages.length, 1);
  assert.match(Object.values(context.__sentMessages[0].actionResults)[0], /Copy button/i);
});

test('plan mode allows storage reads and blocks storage writes', async () => {
  const context = loadPanelContext();
  const executed = [];
  context.__permissionModeEl.value = 'plan';
  context.executeAction = async (type) => {
    executed.push(type);
    return 'ran';
  };

  await context.executeActions([
    { type: 'storage:list', code: 'localStorage', placeholder: 'missing' },
    { type: 'storage:get', code: '{"area":"localStorage","key":"theme"}', placeholder: 'missing' },
    { type: 'storage:set', code: '{"area":"localStorage","key":"theme","value":"dark"}', placeholder: 'missing' },
    { type: 'storage:remove', code: '{"area":"cookie","key":"debug"}', placeholder: 'missing' },
  ]);

  assert.deepEqual(executed, ['storage:list', 'storage:get']);
  const results = Object.values(context.__sentMessages[0].actionResults);
  assert.match(results[2], /blocked/i);
  assert.match(results[3], /blocked/i);
});

test('auto mode asks before storage mutations', async () => {
  const context = loadPanelContext();
  let confirmCalls = 0;
  let executed = false;
  context.confirm = () => {
    confirmCalls += 1;
    return false;
  };
  context.executeAction = async () => {
    executed = true;
    return 'ran';
  };

  await context.executeActions([{ type: 'storage:set', code: '{"area":"localStorage","key":"theme","value":"dark"}', placeholder: 'missing' }]);

  assert.equal(confirmCalls, 1);
  assert.equal(executed, false);
  assert.match(Object.values(context.__sentMessages[0].actionResults)[0], /declined/i);
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
