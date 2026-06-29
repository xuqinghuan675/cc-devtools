const WS_URL = 'ws://localhost:9876';
const ACTION_RE = /\[ACTION:(eval|dom|dom:all|text|console|network|title|url|save)\]([\s\S]*?)\[\/ACTION\]/g;

let ws = null;
let reconnectTimer = null;
let thinkingEl = null;
let consoleInjected = false;
let pendingSaves = {};

const $ = (s) => document.querySelector(s);
const messagesEl = $('#messages');
const inputEl = $('#input');
const sendBtn = $('#send-btn');
const statusEl = $('#status');
const pageInfoEl = $('#page-info');
const resetBtn = $('#reset-btn');
const helpBtn = $('#help-btn');
const helpPanel = $('#help-panel');
const pageContextBtn = $('#page-context-btn');

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  clearReconnect();

  statusEl.textContent = '连接中...';
  statusEl.className = 'status-disconnected';

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    statusEl.textContent = '已连接';
    statusEl.className = 'status-connected';
    clearReconnect();
    updatePageInfo();
  };

  ws.onclose = () => {
    statusEl.textContent = '断开，重连中...';
    statusEl.className = 'status-disconnected';
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    removeThinking();

    if (msg.type === 'response') {
      renderAssistantMessage(msg.content);
    } else if (msg.type === 'error') {
      renderError(msg.message);
    } else if (msg.type === 'reset') {
      addSystemMessage(msg.message);
    } else if (msg.type === 'write_result') {
      if (pendingSaves[msg.id]) {
        pendingSaves[msg.id](msg);
        delete pendingSaves[msg.id];
      }
    }
  };
}

function scheduleReconnect() {
  clearReconnect();
  reconnectTimer = setTimeout(connect, 2000);
}

function clearReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function send(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addSystemMessage('未连接到 Bridge Server，请先运行 node bridge/server.js');
    return;
  }

  const content = msg.content || inputEl.value.trim();
  if (!content && !msg.isActionResult) return;

  if (!msg.isActionResult) {
    addUserMessage(content);
    inputEl.value = '';
    sendBtn.disabled = true;
    inputEl.focus();
  }

  showThinking();

  const payload = {
    type: 'chat',
    content: content,
    pageContext: null,
    actionResults: msg.actionResults || null
  };

  if (!msg.isActionResult) {
    payload.pageContext = getPageContextSync();
  }

  ws.send(JSON.stringify(payload));
}

function getPageContextSync() {
  return {
    url: window.__cc_pageUrl || '',
    title: window.__cc_pageTitle || '',
    bodyText: window.__cc_bodyText || '',
    console: window.__cc_consoleLogs || '',
    dom: window.__cc_dom || ''
  };
}

function updatePageInfo() {
  chrome.devtools.inspectedWindow.eval('document.title', (result) => {
    window.__cc_pageTitle = result || '';
    pageInfoEl.textContent = result || '';
  });
  chrome.devtools.inspectedWindow.eval('location.href', (result) => {
    window.__cc_pageUrl = result || '';
  });
}

function collectPageContext() {
  const code = `
    (function() {
      var ctx = {};

      ctx.url = location.href;
      ctx.title = document.title;

      try {
        var clone = document.body.cloneNode(true);
        var removes = clone.querySelectorAll('script, style, noscript, svg, iframe, [aria-hidden="true"]');
        removes.forEach(function(el) { el.remove(); });
        ctx.bodyText = (clone.textContent || '').replace(/\\n{3,}/g, '\\n\\n').trim();
      } catch(e) {
        ctx.bodyText = (document.body ? document.body.textContent : '') || '';
      }

      try {
        ctx.dom = document.body ? document.body.innerHTML.substring(0, 3000) : '';
      } catch(e) {
        ctx.dom = '';
      }

      return ctx;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
    if (!isException && result) {
      window.__cc_pageUrl = result.url;
      window.__cc_pageTitle = result.title;
      window.__cc_bodyText = result.bodyText;
      window.__cc_dom = result.dom;
      pageInfoEl.textContent = result.title || result.url || '';
      addSystemMessage('页面内容已采集');
    }
  });
}

function injectConsoleInterceptor() {
  if (consoleInjected) return;
  consoleInjected = true;

  const code = `
    (function() {
      if (window.__cc_console_logs) return;
      window.__cc_console_logs = [];
      var methods = ['log','warn','error','info','debug'];
      methods.forEach(function(m) {
        var orig = console[m];
        console[m] = function() {
          var args = Array.from(arguments).map(function(a) {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
            catch(e) { return String(a); }
          }).join(' ');
          window.__cc_console_logs.push('[' + m.toUpperCase() + '] ' + args);
          if (window.__cc_console_logs.length > 200) window.__cc_console_logs.shift();
          orig.apply(console, arguments);
        };
      });
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
    if (!isException) {
      addSystemMessage('已开始监听控制台输出 (最多200条)');
    }
  });
}

function getConsoleLogs() {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      'window.__cc_console_logs ? window.__cc_console_logs.join("\\n") : ""',
      (result) => resolve(result || '')
    );
  });
}

function getNetworkHAR() {
  return new Promise((resolve) => {
    try {
      chrome.devtools.network.getHAR((har) => {
        if (!har || !har.entries) { resolve(''); return; }
        const entries = har.entries.slice(-20).map((e) => {
          return `${e.request.method} ${e.request.url} → ${e.response.status} (${e.response.content?.size || 0} bytes)`;
        });
        resolve(entries.join('\n'));
      });
    } catch {
      resolve('');
    }
  });
}

async function executeAction(type, code) {
  switch (type) {
    case 'eval':
      return executeInspectedWindowEval(code);

    case 'dom':
      return executeInspectedWindowEval(
        `(function(){ var el = document.querySelector(${JSON.stringify(code)}); return el ? el.outerHTML : '未找到元素: ${code}'; })()`
      );

    case 'dom:all':
      return executeInspectedWindowEval(
        `(function(){ var els = document.querySelectorAll(${JSON.stringify(code)}); return Array.from(els).map(function(e){ return e.outerHTML; }).join('\\n---\\n'); })()`
      );

    case 'text':
      return executeInspectedWindowEval(
        `(function(){ var el = document.querySelector(${JSON.stringify(code)}); return el ? el.textContent.trim() : '未找到元素: ${code}'; })()`
      );

    case 'console':
      return getConsoleLogs();

    case 'network':
      return getNetworkHAR();

    case 'title':
      return executeInspectedWindowEval('document.title');

    case 'url':
      return executeInspectedWindowEval('location.href');

    case 'save': {
      const nl = code.indexOf('\n');
      const filePath = nl > 0 ? code.substring(0, nl).trim() : code.trim();
      const fileContent = nl > 0 ? code.substring(nl + 1) : '';
      return executeSaveFile(filePath, fileContent);
    }

    default:
      return '未知操作: ' + type;
  }
}

function executeInspectedWindowEval(code) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (isException) {
        resolve('执行异常: ' + (isException.value || isException));
      } else {
        resolve(result === undefined ? 'undefined' : String(result));
      }
    });
  });
}

function executeSaveFile(filePath, fileContent) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve('保存失败: 未连接到 Bridge Server');
      return;
    }
    const id = 'save_' + Date.now();
    pendingSaves[id] = (msg) => {
      if (msg.success) {
        resolve('文件已保存: ' + msg.path);
      } else {
        resolve('保存失败: ' + msg.error);
      }
    };
    ws.send(JSON.stringify({ type: 'write_file', id, path: filePath, content: fileContent }));
    setTimeout(() => {
      if (pendingSaves[id]) {
        delete pendingSaves[id];
        resolve('保存超时');
      }
    }, 30000);
  });
}

function renderAssistantMessage(content) {
  const parsed = parseActions(content);
  const div = document.createElement('div');
  div.className = 'message message-assistant';

  if (parsed.html) {
    div.innerHTML = parsed.html;
  } else {
    div.textContent = content;
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (parsed.actions.length > 0) {
    executeActions(parsed.actions);
  }
}

function parseActions(content) {
  const actions = [];
  let match;
  const actionRe = new RegExp(ACTION_RE.source, ACTION_RE.flags);

  let html = content;
  actionRe.lastIndex = 0;

  while ((match = actionRe.exec(content)) !== null) {
    const type = match[1];
    const code = match[2];
    const placeholder = `__ACTION_RESULT_${actions.length}__`;
    actions.push({ type, code, placeholder });
    html = html.replace(match[0], `<div class="action-block"><div class="action-label">▶ ${type}: ${escapeHtml(code.substring(0, 80))}</div><span id="${placeholder}">执行中...</span></div>`);
  }

  html = html
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');

  return { html, actions };
}

async function executeActions(actions) {
  if (actions.length === 0) return;

  const actionResults = {};
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const result = await executeAction(a.type, a.code);
    const short = result.length > 2000 ? result.substring(0, 2000) + '...(已截断)' : result;

    const key = `[${a.type}] ${a.code.substring(0, 50)}`;
    actionResults[key] = short;

    const el = document.getElementById(a.placeholder);
    if (el) {
      el.textContent = short;
      el.classList.add('action-result');
    }
  }

  send({ content: '', isActionResult: true, actionResults });
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'message message-user';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'message message-system';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderError(text) {
  const div = document.createElement('div');
  div.className = 'message message-error';
  div.textContent = '错误: ' + text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showThinking() {
  if (thinkingEl) return;
  thinkingEl = document.createElement('div');
  thinkingEl.className = 'thinking';
  thinkingEl.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(thinkingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeThinking() {
  if (thinkingEl) {
    thinkingEl.remove();
    thinkingEl = null;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

sendBtn.addEventListener('click', () => send({ content: inputEl.value.trim() }));

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send({ content: inputEl.value.trim() });
  }
});

inputEl.addEventListener('input', () => {
  sendBtn.disabled = !inputEl.value.trim();
});

resetBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'reset' }));
  }
  messagesEl.innerHTML = '';
  addSystemMessage('对话已重置');
});

helpBtn.addEventListener('click', () => {
  helpPanel.classList.toggle('hidden');
  helpBtn.classList.toggle('active');
});

pageContextBtn.addEventListener('click', () => {
  collectPageContext();
  injectConsoleInterceptor();
});

connect();
sendBtn.disabled = true;
injectConsoleInterceptor();
updatePageInfo();
