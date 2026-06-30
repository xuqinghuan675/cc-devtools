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
  const workflowEl = { ...emptyEl, value: 'local-data-patch' };
  const context = {
    __sentMessages: sentMessages,
    __workflowEl: workflowEl,
    clearTimeout() {},
    console,
    document: {
      createElement: () => ({ ...emptyEl }),
      getElementById: () => emptyEl,
      querySelector: (selector) => selector === '#workflow-select' ? workflowEl : { ...emptyEl },
    },
    chrome: {
      devtools: {
        inspectedWindow: {
          eval: (code, callback) => callback({
            url: 'http://localhost:5173/',
            title: 'Country Selector Loop Demo',
            bodyText: 'Country selector demo page',
            dom: '<main><select id="country-select"></select></main>',
          }, false),
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
            result: {
              framework: 'React',
              bundler: 'Vite',
              entryFiles: ['src/App.jsx'],
              dataHints: ['public/cc-devtools/countries.json']
            }
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
  assert.equal(payload.content, 'debug the dropdown');
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

test('send does not auto-scan project context outside Frontend Loop mode', async () => {
  const context = loadPanelContext();
  context.__workflowEl.value = 'inspect';

  await context.send({ content: 'Inspect this page' });

  assert.equal(context.__sentMessages.length, 1);
  assert.equal(context.__sentMessages[0].type, 'chat');
  assert.equal(context.__sentMessages[0].projectContext, null);
});
