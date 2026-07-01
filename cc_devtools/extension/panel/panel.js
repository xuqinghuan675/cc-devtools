const WS_URL = 'ws://localhost:9876';
const ACTION_RE = /\[ACTION:(eval|dom|dom:all|text|console|network|title|url|save|copy|click|input|press|file:list|file:read|project:scan)\]([\s\S]*?)\[\/ACTION\]/g;
const MAX_ACTION_ROUNDS = 5;
const TOKEN_STORAGE_KEYS = ['CC_DEVTOOLS_TOKEN', 'cc_devtools_token'];
const PLAN_ALLOWED_ACTIONS = new Set(['dom', 'dom:all', 'text', 'console', 'network', 'title', 'url', 'file:list', 'project:scan']);
const AUTO_CONFIRM_ACTIONS = new Set(['eval', 'save', 'file:read']);

let ws = null;
let reconnectTimer = null;
let thinkingEl = null;
let consoleInjected = false;
let pendingSaves = {};
let pendingFileActions = {};
let actionRoundCount = 0;

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
const workflowSelectEl = $('#workflow-select');
const permissionModeSelectEl = $('#permission-mode-select');

const UI_TEXT = {
  en: {
    action: 'Action',
    actionBlockedPlan: 'Action blocked in Plan mode. Switch to Auto or Bypass to run it.',
    actionConfirm: 'Run this high-risk action?',
    actionDeclined: 'Action declined by user.',
    actionLimitReached: 'Automatic action limit reached. Send a new message to continue.',
    collect: 'Collect',
    collectTitle: 'Collect current page context',
    consoleCaptureStarted: 'Console capture started (last 200 entries)',
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed. User interaction may be required.',
    errorPrefix: 'Error: ',
    fileActionDisconnected: 'File action failed: Bridge Server is not connected',
    fileActionFailed: 'File action failed: ',
    fileActionTimedOut: 'File action timed out',
    helpTitle: 'Action Reference',
    helpTitleAttr: 'Show action reference',
    inputPlaceholder: 'Ask the agent to inspect, patch, click, or verify...',
    mode: 'Mode',
    modeTitle: 'Choose CLI permission mode',
    notConnected: 'Not connected to Bridge Server. Run start-bridge.bat or cc-devtools first.',
    pageContextCollected: 'Page context collected',
    projectContextScanned: 'Project context scanned',
    reset: 'Reset',
    resetDone: 'Conversation reset',
    resetTitle: 'Reset conversation',
    running: 'Running...',
    saveDisconnected: 'Save failed: Bridge Server is not connected',
    send: 'Send',
    statusConnected: 'Connected',
    statusConnecting: 'Connecting...',
    statusDisconnected: 'Disconnected',
    statusReconnecting: 'Disconnected, reconnecting...',
    workflow: 'Workflow',
    workflowTitle: 'Choose a DevTools workflow',
    workflows: {
      inspect: 'Inspect',
      debug: 'Debug',
      selector: 'Selector',
      qa: 'QA',
      'local-data-patch': 'Local Data Patch',
      'frontend-loop': 'Frontend Loop',
    },
    permissionModes: {
      auto: 'Auto',
      plan: 'Plan',
      bypassPermissions: 'Bypass',
    },
  },
  zh: {
    action: '动作',
    actionBlockedPlan: '计划模式已阻止该动作。切换到自动或 Bypass 后可执行。',
    actionConfirm: '执行这个高风险动作？',
    actionDeclined: '用户已取消该动作。',
    actionLimitReached: '已达到自动动作轮数上限。发送新消息后可继续。',
    collect: '收集',
    collectTitle: '收集当前页面上下文',
    consoleCaptureStarted: '已开始捕获控制台日志（最近 200 条）',
    copied: '已复制到剪贴板',
    copyFailed: '复制失败，可能需要用户交互。',
    errorPrefix: '错误：',
    fileActionDisconnected: '文件动作失败：Bridge Server 未连接',
    fileActionFailed: '文件动作失败：',
    fileActionTimedOut: '文件动作超时',
    helpTitle: '动作参考',
    helpTitleAttr: '显示动作参考',
    inputPlaceholder: '让 agent 检查、修改、点击或验证...',
    mode: '模式',
    modeTitle: '选择 CLI 权限模式',
    notConnected: '未连接 Bridge Server。请先运行 start-bridge.bat 或 cc-devtools。',
    pageContextCollected: '已收集页面上下文',
    projectContextScanned: '已扫描本地项目上下文',
    reset: '重置',
    resetDone: '对话已重置',
    resetTitle: '重置对话',
    running: '运行中...',
    saveDisconnected: '保存失败：Bridge Server 未连接',
    send: '发送',
    statusConnected: '已连接',
    statusConnecting: '连接中...',
    statusDisconnected: '未连接',
    statusReconnecting: '已断开，正在重连...',
    workflow: '工作流',
    workflowTitle: '选择 DevTools 工作流',
    workflows: {
      inspect: '检查',
      debug: '调试',
      selector: '选择器',
      qa: '验收',
      'local-data-patch': '本地数据修改',
      'frontend-loop': '前端闭环',
    },
    permissionModes: {
      auto: '自动',
      plan: '计划',
      bypassPermissions: 'Bypass',
    },
  },
};

function getUiLocale() {
  const lang = ((navigator && (navigator.language || navigator.userLanguage)) || '').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

function t(key) {
  const locale = getUiLocale();
  return UI_TEXT[locale][key] || UI_TEXT.en[key] || key;
}

function workflowLabel(value) {
  const locale = getUiLocale();
  return UI_TEXT[locale].workflows[value] || UI_TEXT.en.workflows[value] || value;
}

function permissionModeLabel(value) {
  const locale = getUiLocale();
  return UI_TEXT[locale].permissionModes[value] || UI_TEXT.en.permissionModes[value] || value;
}

function applyLocale() {
  const locale = getUiLocale();
  if (document.documentElement) {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    if (document.documentElement.classList) {
      document.documentElement.classList.toggle('locale-zh', locale === 'zh');
    }
  }

  const workflowLabelEl = document.querySelector('#workflow-control span');
  if (workflowLabelEl) workflowLabelEl.textContent = t('workflow');
  if (workflowSelectEl) {
    workflowSelectEl.title = t('workflowTitle');
    if (workflowSelectEl.options) {
      Array.from(workflowSelectEl.options).forEach((option) => {
        option.textContent = workflowLabel(option.value);
      });
    }
  }
  const permissionModeLabelEl = document.querySelector('#permission-mode-control span');
  if (permissionModeLabelEl) permissionModeLabelEl.textContent = t('mode');
  if (permissionModeSelectEl) {
    permissionModeSelectEl.title = t('modeTitle');
    if (permissionModeSelectEl.options) {
      Array.from(permissionModeSelectEl.options).forEach((option) => {
        option.textContent = permissionModeLabel(option.value);
      });
    }
  }
  if (pageContextBtn) {
    pageContextBtn.textContent = t('collect');
    pageContextBtn.title = t('collectTitle');
  }
  if (helpBtn) helpBtn.title = t('helpTitleAttr');
  if (resetBtn) {
    resetBtn.textContent = t('reset');
    resetBtn.title = t('resetTitle');
  }
  const helpTitleEl = document.querySelector('.help-title');
  if (helpTitleEl) helpTitleEl.textContent = t('helpTitle');
  if (inputEl) inputEl.placeholder = t('inputPlaceholder');
  if (sendBtn) sendBtn.textContent = t('send');
  if (statusEl && statusEl.textContent === 'Disconnected') {
    statusEl.textContent = t('statusDisconnected');
  }
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  clearReconnect();

  statusEl.textContent = t('statusConnecting');
  statusEl.className = 'status-disconnected';

  ws = new WebSocket(buildWebSocketUrl());

  ws.onopen = () => {
    statusEl.textContent = t('statusConnected');
    statusEl.className = 'status-connected';
    clearReconnect();
    updatePageInfo();
  };

  ws.onclose = () => {
    statusEl.textContent = t('statusReconnecting');
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
    } else if (msg.type === 'file_result') {
      if (pendingFileActions[msg.id]) {
        pendingFileActions[msg.id](msg);
        delete pendingFileActions[msg.id];
      }
    }
  };
}

function getBridgeToken() {
  const storage = (typeof localStorage !== 'undefined' && localStorage)
    || (typeof window !== 'undefined' && window.localStorage);
  if (!storage) return '';

  for (const key of TOKEN_STORAGE_KEYS) {
    try {
      const token = storage.getItem(key);
      if (token) return token;
    } catch {
      return '';
    }
  }

  return '';
}

function buildWebSocketUrl() {
  const token = getBridgeToken();
  if (!token) return WS_URL;

  const separator = WS_URL.includes('?') ? '&' : '?';
  return `${WS_URL}${separator}token=${encodeURIComponent(token)}`;
}

function scheduleReconnect() {
  clearReconnect();
  reconnectTimer = setTimeout(connect, 2000);
}

function clearReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

async function send(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addSystemMessage(t('notConnected'));
    return;
  }

  const content = msg.content || inputEl.value.trim();
  if (!content && !msg.isActionResult) return;

  if (!msg.isActionResult) {
    actionRoundCount = 0;
    addUserMessage(content);
    inputEl.value = '';
    sendBtn.disabled = true;
    inputEl.focus();
  }

  showThinking();

  if (!msg.isActionResult) {
    injectConsoleInterceptor();
    await collectPageContext({ quiet: true });
    await collectProjectContext({ quiet: true });
  }

  const payload = buildChatPayload({ content, actionResults: msg.actionResults || null });
  if (!msg.isActionResult) {
    payload.pageContext = getPageContextSync();
  }

  ws.send(JSON.stringify(payload));
}

function getSelectedWorkflow() {
  return workflowSelectEl ? workflowSelectEl.value : 'inspect';
}

function getSelectedPermissionMode() {
  return permissionModeSelectEl ? permissionModeSelectEl.value : 'auto';
}

function buildChatPayload(msg) {
  const workflow = getSelectedWorkflow();
  return {
    type: 'chat',
    content: msg.content || '',
    workflow,
    permissionMode: getSelectedPermissionMode(),
    pageContext: null,
    projectContext: workflow === 'frontend-loop' ? getProjectContextSync() : null,
    actionResults: msg.actionResults || null
  };
}

function redactSensitiveText(text) {
  return String(text || '')
    .replace(/([?&](?:access_token|id_token|token|auth|authorization|api[_-]?key|key|password|passwd|secret|session|cookie|csrf|jwt)=)([^&#\s]+)/gi, '$1[redacted]')
    .replace(/\b(authorization:\s*(?:bearer|basic)\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/\b(cookie:\s*)[^\n]+/gi, '$1[redacted]')
    .replace(/\b((?:access_token|id_token|token|api[_-]?key|password|passwd|secret|session|csrf|jwt)\s*[:=]\s*)(["']?)[^\s,"';&]+/gi, '$1$2[redacted]');
}

function getProjectContextSync() {
  return window.__cc_projectContext || null;
}

function getPageContextSync() {
  return {
    url: redactSensitiveText(window.__cc_pageUrl || ''),
    title: window.__cc_pageTitle || '',
    bodyText: redactSensitiveText(window.__cc_bodyText || ''),
    console: redactSensitiveText(window.__cc_consoleLogs || ''),
    dom: redactSensitiveText(window.__cc_dom || '')
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

function collectPageContext(options = {}) {
  const code = `
    (function() {
      var ctx = {};

      ctx.url = location.href;
      ctx.title = document.title;

      try {
        ctx.console = window.__cc_console_logs ? window.__cc_console_logs.join('\\n') : '';
      } catch(e) {
        ctx.console = '';
      }

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

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (!isException && result) {
        window.__cc_pageUrl = result.url;
        window.__cc_pageTitle = result.title;
        window.__cc_bodyText = result.bodyText;
        window.__cc_consoleLogs = result.console || '';
        window.__cc_dom = result.dom;
        pageInfoEl.textContent = result.title || result.url || '';
        if (!options.quiet) addSystemMessage(t('pageContextCollected'));
      }
      resolve(result || null);
    });
  });
}

async function collectProjectContext(options = {}) {
  if (getSelectedWorkflow() !== 'frontend-loop') return null;
  if (window.__cc_projectContext) return window.__cc_projectContext;

  const result = await executeFileAction('project_scan', {}, options.timeoutMs || 5000);
  const normalized = normalizeProjectContext(result);
  if (normalized) {
    window.__cc_projectContext = normalized;
    if (!options.quiet) addSystemMessage(t('projectContextScanned'));
  }
  return window.__cc_projectContext || null;
}

function normalizeProjectContext(result) {
  if (!result) return null;
  if (typeof result !== 'string') return result;

  const trimmed = result.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return trimmed.substring(0, 8000);

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.substring(0, 8000);
  }
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
      addSystemMessage(t('consoleCaptureStarted'));
    }
  });
}

function getConsoleLogs() {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      'window.__cc_console_logs ? window.__cc_console_logs.join("\\n") : ""',
      (result) => resolve(redactSensitiveText(result || ''))
    );
  });
}

function getNetworkHAR() {
  return new Promise((resolve) => {
    try {
      chrome.devtools.network.getHAR((har) => {
        if (!har || !har.entries) { resolve(''); return; }
        const entries = har.entries.slice(-20).map((e) => {
          return `${e.request.method} ${redactSensitiveText(e.request.url)} → ${e.response.status} (${e.response.content?.size || 0} bytes)`;
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
        `(function(){ var el = document.querySelector(${JSON.stringify(code)}); return el ? el.outerHTML : 'Element not found: ${code}'; })()`
      );

    case 'dom:all':
      return executeInspectedWindowEval(
        `(function(){ var els = document.querySelectorAll(${JSON.stringify(code)}); return Array.from(els).map(function(e){ return e.outerHTML; }).join('\\n---\\n'); })()`
      );

    case 'text':
      return executeInspectedWindowEval(
        `(function(){ var el = document.querySelector(${JSON.stringify(code)}); return el ? el.textContent.trim() : 'Element not found: ${code}'; })()`
      );

    case 'console':
      return getConsoleLogs();

    case 'network':
      return getNetworkHAR();

    case 'title':
      return executeInspectedWindowEval('document.title');

    case 'url':
      return executeInspectedWindowEval('location.href');

    case 'copy':
      try {
        await navigator.clipboard.writeText(code);
        return t('copied');
      } catch {
        return t('copyFailed');
      }

    case 'save': {
      const nl = code.indexOf('\n');
      const filePath = nl > 0 ? code.substring(0, nl).trim() : code.trim();
      const fileContent = nl > 0 ? code.substring(nl + 1) : '';
      return executeSaveFile(filePath, fileContent);
    }

    case 'click':
      return executeClick(code.trim());

    case 'input': {
      const nl = code.indexOf('\n');
      const selector = nl > 0 ? code.substring(0, nl).trim() : code.trim();
      const value = nl > 0 ? code.substring(nl + 1) : '';
      return executeInput(selector, value);
    }

    case 'press':
      return executePress(code.trim());

    case 'file:list':
      return executeFileAction('file_list', { pattern: code.trim() || '**/*' });

    case 'file:read':
      return executeFileAction('file_read', { path: code.trim() });

    case 'project:scan':
      return executeFileAction('project_scan', {});

    default:
      return 'Unknown action: ' + type;
  }
}

function executeClick(selector) {
  const notFound = 'Element not found: ' + selector;
  const clicked = 'Clicked: ' + selector;
  return executeInspectedWindowEval(`
    (function() {
      var el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return ${JSON.stringify(notFound)};
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return ${JSON.stringify(clicked)};
    })()
  `);
}

function executeInput(selector, value) {
  const notFound = 'Element not found: ' + selector;
  const typed = 'Input updated: ' + selector;
  return executeInspectedWindowEval(`
    (function() {
      var el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return ${JSON.stringify(notFound)};
      el.focus();
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return ${JSON.stringify(typed)};
    })()
  `);
}

function executePress(key) {
  return executeInspectedWindowEval(`
    (function() {
      var target = document.activeElement || document.body;
      var key = ${JSON.stringify(key || 'Enter')};
      ['keydown', 'keyup'].forEach(function(type) {
        target.dispatchEvent(new KeyboardEvent(type, { key: key, bubbles: true }));
      });
      return 'Key dispatched: ' + key;
    })()
  `);
}

function executeInspectedWindowEval(code) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (isException) {
        resolve('Execution error: ' + (isException.value || isException));
      } else {
        resolve(result === undefined ? 'undefined' : String(result));
      }
    });
  });
}

function executeFileAction(type, payload, timeoutMs = 30000) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve(t('fileActionDisconnected'));
      return;
    }
    const id = 'file_' + Date.now() + '_' + Math.random().toString(16).slice(2);
    pendingFileActions[id] = (msg) => {
      if (msg.success) {
        resolve(msg.result || '');
      } else {
        resolve(t('fileActionFailed') + msg.error);
      }
    };
    ws.send(JSON.stringify({ type, id, ...payload }));
    setTimeout(() => {
      if (pendingFileActions[id]) {
        delete pendingFileActions[id];
        resolve(t('fileActionTimedOut'));
      }
    }, timeoutMs);
  });
}

function executeSaveFile(filePath, fileContent) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve(t('saveDisconnected'));
      return;
    }
    const id = 'save_' + Date.now();
    pendingSaves[id] = (msg) => {
      if (msg.success) {
        resolve('File saved: ' + msg.path);
      } else {
        resolve('Save failed: ' + msg.error);
      }
    };
    ws.send(JSON.stringify({ type: 'write_file', id, path: filePath, content: fileContent }));
    setTimeout(() => {
      if (pendingSaves[id]) {
        delete pendingSaves[id];
        resolve('Save timed out');
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
  const htmlParts = [];
  let lastIndex = 0;

  actionRe.lastIndex = 0;

  while ((match = actionRe.exec(content)) !== null) {
    htmlParts.push(formatMessageText(content.substring(lastIndex, match.index)));
    const type = match[1];
    const code = match[2];
    const placeholder = `__ACTION_RESULT_${actions.length}__`;
    actions.push({ type, code, placeholder });
    htmlParts.push(`<div class="action-block"><div class="action-label">${t('action')} ${type}: ${escapeHtml(code.substring(0, 80))}</div><span id="${placeholder}">${t('running')}</span></div>`);
    lastIndex = actionRe.lastIndex;
  }

  htmlParts.push(formatMessageText(content.substring(lastIndex)));

  return { html: htmlParts.join(''), actions };
}

function formatMessageText(text) {
  return escapeHtml(text)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function actionPolicy(type, permissionMode = getSelectedPermissionMode()) {
  if (permissionMode === 'bypassPermissions') return 'allow';
  if (permissionMode === 'plan') {
    return PLAN_ALLOWED_ACTIONS.has(type) ? 'allow' : 'block';
  }
  return AUTO_CONFIRM_ACTIONS.has(type) ? 'confirm' : 'allow';
}

function confirmAction(type, code) {
  const preview = String(code || '').trim().slice(0, 240);
  const message = `${t('actionConfirm')}\n\n[ACTION:${type}]\n${preview}`;
  if (typeof confirm === 'function') return confirm(message);
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return false;
}

async function executeActions(actions) {
  if (actions.length === 0) return;
  if (actionRoundCount >= MAX_ACTION_ROUNDS) {
    const message = t('actionLimitReached');
    for (const a of actions) {
      const el = document.getElementById(a.placeholder);
      if (el) {
        el.textContent = message;
        el.classList.add('action-result');
      }
    }
    addSystemMessage(message);
    return;
  }

  actionRoundCount += 1;
  const actionResults = {};
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const policy = actionPolicy(a.type);
    let result;
    if (policy === 'block') {
      result = t('actionBlockedPlan');
    } else if (policy === 'confirm' && !confirmAction(a.type, a.code)) {
      result = t('actionDeclined');
    } else {
      result = await executeAction(a.type, a.code);
    }
    const resultText = redactSensitiveText(result);
    const short = resultText.length > 2000 ? resultText.substring(0, 2000) + '...(truncated)' : resultText;

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
  div.textContent = t('errorPrefix') + text;
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
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

applyLocale();

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
  actionRoundCount = 0;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'reset' }));
  }
  messagesEl.innerHTML = '';
  addSystemMessage(t('resetDone'));
});

helpBtn.addEventListener('click', () => {
  helpPanel.classList.toggle('hidden');
  helpBtn.classList.toggle('active');
});

pageContextBtn.addEventListener('click', () => {
  collectPageContext();
  injectConsoleInterceptor();
});

if (chrome.devtools.network && chrome.devtools.network.onNavigated) {
  chrome.devtools.network.onNavigated.addListener(() => {
    consoleInjected = false;
    window.__cc_consoleLogs = '';
    window.__cc_bodyText = '';
    window.__cc_dom = '';
    updatePageInfo();
    injectConsoleInterceptor();
  });
}

sendBtn.disabled = true;
connect();
injectConsoleInterceptor();
updatePageInfo();
