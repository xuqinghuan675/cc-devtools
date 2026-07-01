import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadPanelContext(options = {}) {
  const source = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = source.split('\nsendBtn.addEventListener')[0];
  const sentMessages = [];
  const projectScanResult = options.projectScanResult ?? {
    framework: 'React',
    bundler: 'Vite',
    entryFiles: ['src/App.jsx'],
    dataHints: ['public/cc-devtools/countries.json'],
  };
  const inspectedConsoleLogs = options.inspectedConsoleLogs || [];
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
  const permissionModeEl = { ...emptyEl, value: 'auto' };
  const context = {
    __sentMessages: sentMessages,
    __workflowEl: workflowEl,
    __permissionModeEl: permissionModeEl,
    clearTimeout() {},
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => {
        if (selector === '#workflow-select') return workflowEl;
        if (selector === '#permission-mode-select') return permissionModeEl;
        return { ...emptyEl };
      },
    },
    chrome: {
      devtools: {
        inspectedWindow: {
          eval: (code, callback) => {
            if (code.includes('var ctx = {};')) {
              callback({
                url: 'http://localhost:5173/',
                title: 'Country Selector Loop Demo',
                bodyText: 'Country selector demo page',
                dom: '<main><select id="country-select"></select></main>',
                ...(code.includes('__cc_console_logs') ? { console: inspectedConsoleLogs.join('\n') } : {}),
              }, false);
              return;
            }
            callback(undefined, false);
          },
        },
        network: {},
      },
    },
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: {},
    WebSocket: { OPEN: 1 },
  };
  vm.createContext(context);
  vm.runInContext(definitionsOnly, context);
  vm.runInContext(`
    ws = {
      readyState: WebSocket.OPEN,
      send(payload) {
        const msg = JSON.parse(payload);
        __sentMessages.push(msg);
        if (msg.type === 'project_scan') {
          pendingFileActions[msg.id]({
            id: msg.id,
            type: 'file_result',
            success: true,
            result: ${JSON.stringify(projectScanResult)}
          });
        }
      }
    };
  `, context);
  return context;
}

test('buildChatPayload includes selected workflow', () => {
  const { buildChatPayload } = loadPanelContext();

  const payload = buildChatPayload({ content: 'debug the dropdown' });

  assert.equal(payload.workflow, 'local-data-patch');
  assert.equal(payload.permissionMode, 'auto');
  assert.equal(payload.content, 'debug the dropdown');
});

test('buildChatPayload includes selected permission mode', () => {
  const context = loadPanelContext();
  context.__permissionModeEl.value = 'plan';

  const payload = context.buildChatPayload({ content: 'prepare a change plan' });

  assert.equal(payload.permissionMode, 'plan');
});

test('send auto-attaches project context in Frontend Loop mode', async () => {
  const context = loadPanelContext();
  context.__workflowEl.value = 'frontend-loop';

  await context.send({ content: 'Add Singapore and verify it' });

  const [scan, chat] = context.__sentMessages;
  assert.equal(scan.type, 'project_scan');
  assert.equal(chat.type, 'chat');
  assert.equal(chat.workflow, 'frontend-loop');
  assert.equal(chat.pageContext.url, 'http://localhost:5173/');
  assert.deepEqual(JSON.parse(JSON.stringify(chat.projectContext)), {
    framework: 'React',
    bundler: 'Vite',
    entryFiles: ['src/App.jsx'],
    dataHints: ['public/cc-devtools/countries.json'],
  });
});

test('send preserves markdown project scan in Frontend Loop mode', async () => {
  const markdownScan = [
    '# Frontend Project Scan',
    'Framework: React',
    'Bundler: Vite',
  ].join('\n');
  const context = loadPanelContext({ projectScanResult: markdownScan });
  context.__workflowEl.value = 'frontend-loop';

  await context.send({ content: 'Use the scanned project context' });

  const chat = context.__sentMessages.find((msg) => msg.type === 'chat');
  assert.equal(chat.projectContext, markdownScan);
});

test('send auto-attaches inspected console logs', async () => {
  const context = loadPanelContext({
    inspectedConsoleLogs: ['[ERROR] Failed to load countries'],
  });

  await context.send({ content: 'Diagnose the page error' });

  const chat = context.__sentMessages.find((msg) => msg.type === 'chat');
  assert.equal(chat.pageContext.console, '[ERROR] Failed to load countries');
});

test('send does not auto-scan project context outside Frontend Loop mode', async () => {
  const context = loadPanelContext();
  context.__workflowEl.value = 'inspect';

  await context.send({ content: 'Inspect this page' });

  assert.equal(context.__sentMessages.length, 1);
  assert.equal(context.__sentMessages[0].type, 'chat');
  assert.equal(context.__sentMessages[0].projectContext, null);
});

test('getNetworkHAR redacts token-like URL values', async () => {
  const context = loadPanelContext();
  context.chrome.devtools.network.getHAR = (callback) => callback({
    entries: [{
      request: { method: 'GET', url: 'https://api.test/users?token=abc123&country=SG' },
      response: { status: 200, content: { size: 42 } },
    }],
  });

  const result = await context.getNetworkHAR();

  assert.match(result, /token=\[redacted\]/);
  assert.match(result, /country=SG/);
  assert.ok(!result.includes('abc123'));
});
