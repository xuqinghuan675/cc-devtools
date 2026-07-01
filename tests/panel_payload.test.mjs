import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadPanelContext(options = {}) {
  const source = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const definitionsOnly = source.split('\nsendBtn.addEventListener')[0];
  const sentMessages = [];
  const storage = options.storage || {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, String(value)); },
    removeItem(key) { this.values.delete(key); },
  };
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
  const maxActionRoundsEl = { ...emptyEl, value: '5' };
  const bridgeTokenEl = { ...emptyEl, value: '' };
  const saveTokenBtn = { ...emptyEl };
  const tokenUsageEl = { ...emptyEl };
  const context = {
    __sentMessages: sentMessages,
    __workflowEl: workflowEl,
    __permissionModeEl: permissionModeEl,
    __maxActionRoundsEl: maxActionRoundsEl,
    __bridgeTokenEl: bridgeTokenEl,
    __storage: storage,
    __tokenUsageEl: tokenUsageEl,
    clearTimeout() {},
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => {
        if (selector === '#workflow-select') return workflowEl;
        if (selector === '#permission-mode-select') return permissionModeEl;
        if (selector === '#max-action-rounds') return maxActionRoundsEl;
        if (selector === '#bridge-token') return bridgeTokenEl;
        if (selector === '#save-token-btn') return saveTokenBtn;
        if (selector === '#token-usage') return tokenUsageEl;
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
    localStorage: storage,
    navigator: { clipboard: { writeText() {} } },
    setTimeout() {},
    window: { localStorage: storage },
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

test('buildChatPayload includes configured action round limit', () => {
  const context = loadPanelContext();
  context.__maxActionRoundsEl.value = '9';

  const payload = context.buildChatPayload({ content: 'continue carefully' });

  assert.equal(payload.maxActionRounds, 9);
});

test('token usage estimate formats as raw, k, and M units', () => {
  const context = loadPanelContext();

  assert.equal(context.formatCompactTokenCount(999), '999');
  assert.equal(context.formatCompactTokenCount(1500), '1.5k');
  assert.equal(context.formatCompactTokenCount(1200000), '1.2M');
});

test('bridge token control stores token and appends it to the websocket URL', () => {
  const context = loadPanelContext();

  context.__bridgeTokenEl.value = 'secret token';
  context.persistBridgeToken();

  assert.equal(context.__storage.getItem('CC_DEVTOOLS_TOKEN'), 'secret token');
  assert.equal(context.buildWebSocketUrl(), 'ws://localhost:9876?token=secret%20token');
});

test('token usage display accumulates chat payload text', () => {
  const context = loadPanelContext();

  context.resetTokenUsage();
  context.addTokenUsageFromPayload({ content: 'a'.repeat(4000), actionResults: null });
  assert.equal(context.__tokenUsageEl.textContent, 'Tokens: 1k');

  context.addTokenUsageFromPayload({ content: '', actionResults: { '[title]': 'b'.repeat(4000) } });
  assert.equal(context.__tokenUsageEl.textContent, 'Tokens: 2k');
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

test('parseDomAllOptions accepts selector strings and JSON pagination payloads', () => {
  const context = loadPanelContext();

  assert.deepEqual(JSON.parse(JSON.stringify(context.parseDomAllOptions('button'))), {
    selector: 'button',
    offset: 0,
    limit: 25,
    format: 'html',
    maxChars: 12000,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context.parseDomAllOptions('{"selector":"button","offset":25,"limit":10,"format":"summary","maxChars":4000}'))), {
    selector: 'button',
    offset: 25,
    limit: 10,
    format: 'summary',
    maxChars: 4000,
  });
});

test('formatDomAllResult reports pagination and next action hint', () => {
  const context = loadPanelContext();

  const result = context.formatDomAllResult({
    selector: 'button',
    offset: 0,
    limit: 2,
    format: 'summary',
    maxChars: 12000,
    total: 3,
    items: ['#1 button Save', '#2 button Cancel'],
  });

  assert.match(result, /Total: 3/);
  assert.match(result, /Showing: 1-2/);
  assert.match(result, /hasMore: true/);
  assert.match(result, /\[ACTION:dom:all\]\{"selector":"button","offset":2,"limit":2,"format":"summary","maxChars":12000\}\[\/ACTION\]/);
});

test('network summary uses stable ids and redacts sensitive URLs', async () => {
  const context = loadPanelContext();
  const entry = {
    startedDateTime: '2026-07-01T00:00:00.000Z',
    _resourceType: 'fetch',
    request: { method: 'GET', url: 'https://api.test/users?token=abc123&country=SG', headers: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 42, mimeType: 'application/json' } },
    time: 128,
  };

  context.rememberNetworkRequest(entry);
  const result = await context.getNetworkHAR('{"filter":"fetch","limit":10}');

  assert.match(result, /#1 GET https:\/\/api\.test\/users\?token=\[redacted\]&country=SG/);
  assert.match(result, /200/);
  assert.match(result, /128ms/);
  assert.match(result, /hasMore: false/);
  assert.ok(!result.includes('abc123'));
});

test('network detail includes headers, post data, timings and response preview', async () => {
  const context = loadPanelContext();
  const entry = {
    startedDateTime: '2026-07-01T00:00:00.000Z',
    _resourceType: 'xhr',
    _initiator: { type: 'script', stack: { callFrames: [{ functionName: 'loadUsers', url: 'app.js', lineNumber: 9 }] } },
    request: {
      method: 'POST',
      url: 'https://api.test/users',
      headers: [{ name: 'Authorization', value: 'Bearer secret-value' }],
      postData: { text: '{"token":"abc123","country":"SG"}' },
    },
    response: {
      status: 201,
      statusText: 'Created',
      headers: [{ name: 'content-type', value: 'application/json' }],
      content: { size: 24, mimeType: 'application/json' },
    },
    timings: { wait: 10, receive: 4 },
    time: 44,
    getContent(callback) {
      callback('{"ok":true,"token":"abc123"}', 'utf-8');
    },
  };

  context.rememberNetworkRequest(entry);
  const result = await context.getNetworkHAR('{"id":1,"detail":true,"bodyLimit":2000}');

  assert.match(result, /Request #1/);
  assert.match(result, /POST https:\/\/api\.test\/users/);
  assert.match(result, /Authorization: Bearer \[redacted\]/);
  assert.match(result, /Post Data/);
  assert.match(result, /"country":"SG"/);
  assert.match(result, /Response Preview/);
  assert.match(result, /"ok":true/);
  assert.match(result, /Initiator/);
  assert.ok(!result.includes('secret-value'));
  assert.ok(!result.includes('abc123'));
});

test('file read action accepts JSON pagination payloads', async () => {
  const context = loadPanelContext();

  const resultPromise = context.executeAction(
    'file:read',
    '{"path":"src/App.jsx","offset":12000,"limit":4000}',
  );

  const msg = context.__sentMessages[0];
  assert.equal(msg.type, 'file_read');
  assert.equal(msg.path, 'src/App.jsx');
  assert.equal(msg.offset, 12000);
  assert.equal(msg.limit, 4000);

  vm.runInContext(
    `pendingFileActions[${JSON.stringify(msg.id)}]({ id: ${JSON.stringify(msg.id)}, type: 'file_result', success: true, result: 'page text' })`,
    context,
  );

  assert.equal(await resultPromise, 'page text');
});

test('packaged and load-unpacked panel scripts stay synchronized', () => {
  const packaged = readFileSync('cc_devtools/extension/panel/panel.js', 'utf8');
  const unpacked = readFileSync('extension/panel/panel.js', 'utf8');

  assert.equal(packaged, unpacked);
});
