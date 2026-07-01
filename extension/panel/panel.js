const WS_URL = 'ws://localhost:9876';
const ACTION_RE = /\[ACTION:(eval|dom|dom:all|text|console|network|title|url|save|copy|click|input|press|file:list|file:read|project:scan|storage:list|storage:get|storage:set|storage:remove)\]([\s\S]*?)\[\/ACTION\]/g;
const DEFAULT_MAX_ACTION_ROUNDS = 5;
const MIN_ACTION_ROUNDS = 1;
const MAX_ACTION_ROUNDS_LIMIT = 25;
const ACTION_EVIDENCE_DELAY_MS = 350;
const TOKEN_STORAGE_KEYS = ['CC_DEVTOOLS_TOKEN', 'cc_devtools_token'];
const TOKEN_STORAGE_KEY = TOKEN_STORAGE_KEYS[0];
const ACTION_ROUNDS_STORAGE_KEY = 'CC_DEVTOOLS_MAX_ACTION_ROUNDS';
const PLAN_ALLOWED_ACTIONS = new Set(['dom', 'dom:all', 'text', 'console', 'network', 'title', 'url', 'copy', 'file:list', 'project:scan', 'storage:list', 'storage:get']);
const AUTO_CONFIRM_ACTIONS = new Set(['eval', 'save', 'file:read', 'storage:set', 'storage:remove']);
const EVIDENCE_ACTIONS = new Set(['eval', 'click', 'input', 'press', 'storage:set', 'storage:remove']);
const DEFAULT_ACTION_RESULT_MAX_CHARS = 12000;
const DEFAULT_FILE_READ_LIMIT = 20000;
const MAX_NETWORK_REQUESTS = 200;

let ws = null;
let reconnectTimer = null;
let thinkingEl = null;
let consoleInjected = false;
let pendingSaves = {};
let pendingFileActions = {};
let actionRoundCount = 0;
let manualCopyPayloads = {};
let networkRequests = [];
let nextNetworkRequestId = 1;
let pickPollTimer = null;
let conversationTokenCount = 0;

const $ = (s) => document.querySelector(s);
const messagesEl = $('#messages');
const inputEl = $('#input');
const sendBtn = $('#send-btn');
const statusEl = $('#status');
const pageInfoEl = $('#page-info');
const tokenUsageEl = $('#token-usage');
const resetBtn = $('#reset-btn');
const helpBtn = $('#help-btn');
const helpPanel = $('#help-panel');
const pickBtn = $('#pick-btn');
const pageContextBtn = $('#page-context-btn');
const workflowSelectEl = $('#workflow-select');
const permissionModeSelectEl = $('#permission-mode-select');
const maxActionRoundsEl = $('#max-action-rounds');
const bridgeTokenEl = $('#bridge-token');
const saveTokenBtn = $('#save-token-btn');

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
    copyManualReady: 'Copy prepared. Use the Copy button in this action block.',
    copyFailed: 'Copy failed. User interaction may be required.',
    copyReady: 'Ready to copy',
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
    pick: 'Pick',
    pickArmed: 'Element picker armed. Click an element in the inspected page.',
    pickEmpty: 'No picked element yet.',
    pickResultTitle: 'Picked element',
    pickTitle: 'Pick an element from the inspected page',
    projectContextScanned: 'Project context scanned',
    reset: 'Reset',
    resetDone: 'Conversation reset',
    resetTitle: 'Reset conversation',
    rounds: 'Rounds',
    roundsTitle: 'Maximum automatic action-result rounds per user message',
    running: 'Running...',
    saveDisconnected: 'Save failed: Bridge Server is not connected',
    send: 'Send',
    statusConnected: 'Connected',
    statusConnecting: 'Connecting...',
    statusDisconnected: 'Disconnected',
    statusReconnecting: 'Disconnected, reconnecting...',
    saveToken: 'Save',
    saveTokenTitle: 'Save bridge token',
    token: 'Token',
    tokenCleared: 'Bridge token cleared',
    tokenPlaceholder: 'Paste token',
    tokenSaved: 'Bridge token saved',
    tokenTitle: 'Paste the token printed by start-bridge.bat',
    tokenUsageTitle: 'Estimated current conversation token usage',
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
    tokenUsageTitle: '\u5f53\u524d\u5bf9\u8bdd\u4f30\u7b97 token \u6d88\u8017',
    saveToken: 'Save',
    saveTokenTitle: 'Save bridge token',
    token: 'Token',
    tokenCleared: 'Bridge token cleared',
    tokenPlaceholder: 'Paste token',
    tokenSaved: 'Bridge token saved',
    tokenTitle: 'Paste the token printed by start-bridge.bat',
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
  const actionRoundsLabelEl = document.querySelector('#action-rounds-control span');
  if (actionRoundsLabelEl) actionRoundsLabelEl.textContent = t('rounds');
  if (maxActionRoundsEl) maxActionRoundsEl.title = t('roundsTitle');
  const tokenLabelEl = document.querySelector('#token-control span');
  if (tokenLabelEl) tokenLabelEl.textContent = t('token');
  if (bridgeTokenEl) {
    bridgeTokenEl.placeholder = t('tokenPlaceholder');
    bridgeTokenEl.title = t('tokenTitle');
  }
  if (saveTokenBtn) {
    saveTokenBtn.textContent = t('saveToken');
    saveTokenBtn.title = t('saveTokenTitle');
  }
  if (pageContextBtn) {
    pageContextBtn.textContent = t('collect');
    pageContextBtn.title = t('collectTitle');
  }
  if (pickBtn) {
    pickBtn.textContent = t('pick');
    pickBtn.title = t('pickTitle');
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
  updateTokenUsageDisplay();
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
      addTokenUsageFromText(msg.content);
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

function getPanelStorage() {
  const storage = (typeof localStorage !== 'undefined' && localStorage)
    || (typeof window !== 'undefined' && window.localStorage);
  return storage || null;
}

function getStoredBridgeToken() {
  const storage = getPanelStorage();
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

function getBridgeToken() {
  if (bridgeTokenEl && bridgeTokenEl.value.trim()) {
    return bridgeTokenEl.value.trim();
  }
  return getStoredBridgeToken();
}

function persistBridgeToken() {
  if (!bridgeTokenEl) return;
  const token = bridgeTokenEl.value.trim();
  const storage = getPanelStorage();
  if (storage) {
    try {
      for (const key of TOKEN_STORAGE_KEYS) {
        storage.removeItem(key);
      }
      if (token) {
        storage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } catch {
      // Keep the in-memory input value even when storage is unavailable.
    }
  }
  addSystemMessage(token ? t('tokenSaved') : t('tokenCleared'));
  if (ws && typeof WebSocket === 'function') {
    clearReconnect();
    ws.onclose = null;
    try { ws.close(); } catch {}
    ws = null;
    connect();
  }
}

function initBridgeTokenControl() {
  if (!bridgeTokenEl) return;
  bridgeTokenEl.value = getStoredBridgeToken();
  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', persistBridgeToken);
  }
  bridgeTokenEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      persistBridgeToken();
    }
  });
}

function getConfiguredMaxActionRounds() {
  return clampNumber(
    maxActionRoundsEl ? maxActionRoundsEl.value : DEFAULT_MAX_ACTION_ROUNDS,
    DEFAULT_MAX_ACTION_ROUNDS,
    MIN_ACTION_ROUNDS,
    MAX_ACTION_ROUNDS_LIMIT,
  );
}

function persistMaxActionRounds() {
  if (!maxActionRoundsEl) return;
  const value = getConfiguredMaxActionRounds();
  maxActionRoundsEl.value = String(value);
  const storage = getPanelStorage();
  if (!storage) return;
  try {
    storage.setItem(ACTION_ROUNDS_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures; the in-memory control value still applies.
  }
}

function initActionRoundControl() {
  if (!maxActionRoundsEl) return;
  const storage = getPanelStorage();
  if (storage) {
    try {
      const saved = storage.getItem(ACTION_ROUNDS_STORAGE_KEY);
      if (saved) {
        maxActionRoundsEl.value = String(clampNumber(saved, DEFAULT_MAX_ACTION_ROUNDS, MIN_ACTION_ROUNDS, MAX_ACTION_ROUNDS_LIMIT));
      }
    } catch {
      // Storage is best-effort only.
    }
  }
  maxActionRoundsEl.value = String(getConfiguredMaxActionRounds());
  maxActionRoundsEl.addEventListener('change', persistMaxActionRounds);
  maxActionRoundsEl.addEventListener('blur', persistMaxActionRounds);
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

  addTokenUsageFromPayload(payload);
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
    maxActionRounds: getConfiguredMaxActionRounds(),
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
    .replace(/(["'](?:access_token|id_token|token|auth|authorization|api[_-]?key|key|password|passwd|secret|session|cookie|csrf|jwt)["']\s*:\s*["'])[^"']+/gi, '$1[redacted]')
    .replace(/\b((?:access_token|id_token|token|api[_-]?key|password|passwd|secret|session|csrf|jwt)\s*[:=]\s*)(["']?)[^\s,"';&]+/gi, '$1$2[redacted]');
}

function parseJsonPayload(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function trimScaledNumber(value) {
  const precision = value < 10 ? 1 : 0;
  return value.toFixed(precision).replace(/\.0$/, '');
}

function formatCompactTokenCount(count) {
  const value = Math.max(0, Math.round(Number(count) || 0));
  if (value >= 1000000) return `${trimScaledNumber(value / 1000000)}M`;
  if (value >= 1000) return `${trimScaledNumber(value / 1000)}k`;
  return String(value);
}

function estimateTextTokens(text) {
  const value = String(text || '');
  if (!value) return 0;
  const cjkMatches = value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [];
  const nonCjk = value.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, '');
  return Math.max(1, cjkMatches.length + Math.ceil(nonCjk.length / 4));
}

function estimateValueTokens(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return estimateTextTokens(value);
  if (typeof value === 'number' || typeof value === 'boolean') return estimateTextTokens(String(value));
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + estimateValueTokens(item), 0);
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce(
      (total, [key, item]) => total + estimateTextTokens(key) + estimateValueTokens(item),
      0,
    );
  }
  return estimateTextTokens(String(value));
}

function updateTokenUsageDisplay() {
  if (!tokenUsageEl) return;
  tokenUsageEl.textContent = `Tokens: ${formatCompactTokenCount(conversationTokenCount)}`;
  tokenUsageEl.title = t('tokenUsageTitle');
}

function resetTokenUsage() {
  conversationTokenCount = 0;
  updateTokenUsageDisplay();
}

function addTokenUsage(count) {
  conversationTokenCount += Math.max(0, Math.round(Number(count) || 0));
  updateTokenUsageDisplay();
}

function addTokenUsageFromPayload(payload) {
  addTokenUsage(
    estimateValueTokens(payload && payload.content)
    + estimateValueTokens(payload && payload.actionResults)
    + estimateValueTokens(payload && payload.pageContext)
    + estimateValueTokens(payload && payload.projectContext),
  );
}

function addTokenUsageFromText(text) {
  addTokenUsage(estimateTextTokens(text));
}

function parseDomAllOptions(code) {
  const payload = parseJsonPayload(code);
  const options = payload && !Array.isArray(payload)
    ? payload
    : { selector: String(code || '').trim() };

  return {
    selector: String(options.selector || '').trim() || '*',
    offset: clampNumber(options.offset, 0, 0, 100000),
    limit: clampNumber(options.limit, 25, 1, 200),
    format: options.format === 'summary' ? 'summary' : 'html',
    maxChars: clampNumber(options.maxChars, DEFAULT_ACTION_RESULT_MAX_CHARS, 1000, 50000),
  };
}

function parseFileReadPayload(code) {
  const payload = parseJsonPayload(code);
  if (payload && !Array.isArray(payload)) {
    return {
      path: String(payload.path || '').trim(),
      offset: clampNumber(payload.offset, 0, 0, 100000000),
      limit: clampNumber(payload.limit, DEFAULT_FILE_READ_LIMIT, 1, 100000),
    };
  }
  return {
    path: String(code || '').trim(),
    offset: 0,
    limit: DEFAULT_FILE_READ_LIMIT,
  };
}

function formatDomAllResult(result) {
  const total = clampNumber(result.total, 0, 0, 1000000);
  const offset = clampNumber(result.offset, 0, 0, 1000000);
  const limit = clampNumber(result.limit, 25, 1, 200);
  const maxChars = clampNumber(result.maxChars, DEFAULT_ACTION_RESULT_MAX_CHARS, 1000, 50000);
  const items = Array.isArray(result.items) ? result.items : [];
  const shownStart = total === 0 || items.length === 0 ? 0 : offset + 1;
  const shownEnd = total === 0 || items.length === 0 ? 0 : Math.min(offset + items.length, total);
  const hasMore = offset + items.length < total;
  const header = [
    `DOM matches for "${result.selector || '*'}"`,
    `Total: ${total}`,
    `Showing: ${shownStart}-${shownEnd}`,
    `hasMore: ${hasMore}`,
  ];

  if (hasMore) {
    const nextPayload = {
      selector: result.selector || '*',
      offset: offset + limit,
      limit,
      format: result.format === 'summary' ? 'summary' : 'html',
      maxChars,
    };
    header.push(`Next: [ACTION:dom:all]${JSON.stringify(nextPayload)}[/ACTION]`);
  }

  let body = items.join(result.format === 'summary' ? '\n' : '\n---\n');
  if (body.length > maxChars) {
    body = `${body.substring(0, maxChars)}\n[truncated at ${maxChars} chars; request a smaller limit or summary format]`;
  }
  return `${header.join('\n')}${body ? `\n\n${body}` : ''}`;
}

function buildDomAllScript(options) {
  return `
    (function() {
      var selector = ${JSON.stringify(options.selector)};
      var offset = ${JSON.stringify(options.offset)};
      var limit = ${JSON.stringify(options.limit)};
      var format = ${JSON.stringify(options.format)};
      var maxChars = ${JSON.stringify(options.maxChars)};
      var els = Array.from(document.querySelectorAll(selector));
      var slice = els.slice(offset, offset + limit);
      function attr(el, name) {
        var value = el.getAttribute && el.getAttribute(name);
        return value ? name + '="' + value + '"' : '';
      }
      function summarize(el, index) {
        var attrs = ['id','class','name','type','role','aria-label','data-testid','href']
          .map(function(name) { return attr(el, name); })
          .filter(Boolean)
          .join(' ');
        var text = ((el.innerText || el.textContent || '') + '').replace(/\\s+/g, ' ').trim().slice(0, 160);
        var label = '#' + (offset + index + 1) + ' ' + el.tagName.toLowerCase();
        if (attrs) label += ' ' + attrs;
        if (text) label += ' text="' + text + '"';
        return label;
      }
      var items = slice.map(function(el, index) {
        return format === 'summary' ? summarize(el, index) : el.outerHTML;
      });
      return {
        selector: selector,
        offset: offset,
        limit: limit,
        format: format,
        maxChars: maxChars,
        total: els.length,
        items: items
      };
    })()
  `;
}

function truncateText(text, maxChars = DEFAULT_ACTION_RESULT_MAX_CHARS) {
  const value = String(text || '');
  const limit = clampNumber(maxChars, DEFAULT_ACTION_RESULT_MAX_CHARS, 1000, 100000);
  if (value.length <= limit) return value;
  return `${value.substring(0, limit)}\n[truncated at ${limit} chars]`;
}

function actionResultMaxChars(action) {
  if (action && action.type === 'file:read') {
    const options = parseFileReadPayload(action.code);
    return clampNumber(options.limit + 2000, DEFAULT_FILE_READ_LIMIT + 2000, 1000, 100000);
  }
  return DEFAULT_ACTION_RESULT_MAX_CHARS;
}

function networkEntryKey(entry) {
  const request = entry.request || {};
  const response = entry.response || {};
  return [
    entry.startedDateTime || '',
    request.method || '',
    request.url || '',
    response.status || '',
  ].join('|');
}

function rememberNetworkRequest(entry) {
  if (!entry || !entry.request) return null;
  const key = networkEntryKey(entry);
  const existing = networkRequests.find((record) => record.key === key);
  if (existing) {
    existing.entry = entry;
    return existing;
  }

  const record = {
    id: nextNetworkRequestId++,
    key,
    entry,
    contentLoaded: false,
    content: '',
    contentEncoding: '',
  };
  networkRequests.push(record);
  if (networkRequests.length > MAX_NETWORK_REQUESTS) networkRequests.shift();
  return record;
}

function refreshNetworkRequestsFromHAR() {
  return new Promise((resolve) => {
    try {
      if (!chrome.devtools.network || typeof chrome.devtools.network.getHAR !== 'function') {
        resolve();
        return;
      }
      chrome.devtools.network.getHAR((har) => {
        if (har && Array.isArray(har.entries)) {
          har.entries.forEach((entry) => rememberNetworkRequest(entry));
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

function parseNetworkOptions(code) {
  const payload = parseJsonPayload(code) || {};
  return {
    id: payload.id === undefined ? null : clampNumber(payload.id, null, 1, 1000000),
    detail: payload.detail === true,
    offset: clampNumber(payload.offset, 0, 0, 100000),
    limit: clampNumber(payload.limit, 20, 1, 100),
    filter: ['all', 'xhr', 'fetch', 'document', 'script', 'css', 'image'].includes(payload.filter) ? payload.filter : 'all',
    bodyLimit: clampNumber(payload.bodyLimit, DEFAULT_ACTION_RESULT_MAX_CHARS, 1000, 50000),
  };
}

function getNetworkType(entry) {
  const type = entry._resourceType || entry.resourceType || '';
  if (type) return String(type).toLowerCase();
  const mime = String(entry.response?.content?.mimeType || '').toLowerCase();
  if (mime.includes('html')) return 'document';
  if (mime.includes('javascript')) return 'script';
  if (mime.includes('css')) return 'css';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('json')) return 'xhr';
  return 'other';
}

function filterNetworkRecords(options) {
  if (options.filter === 'all') return networkRequests;
  return networkRequests.filter((record) => getNetworkType(record.entry) === options.filter);
}

function formatHeaderList(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return '(none)';
  return headers.map((header) => redactSensitiveText(`${header.name}: ${header.value || ''}`)).join('\n');
}

function formatNetworkSummary(options) {
  const records = filterNetworkRecords(options);
  const slice = records.slice(options.offset, options.offset + options.limit);
  const shownStart = records.length === 0 || slice.length === 0 ? 0 : options.offset + 1;
  const shownEnd = records.length === 0 || slice.length === 0 ? 0 : Math.min(options.offset + slice.length, records.length);
  const hasMore = options.offset + slice.length < records.length;
  const lines = [
    'Network requests',
    `Total: ${records.length}`,
    `Showing: ${shownStart}-${shownEnd}`,
    `hasMore: ${hasMore}`,
  ];
  if (hasMore) {
    const nextPayload = { offset: options.offset + options.limit, limit: options.limit, filter: options.filter };
    lines.push(`Next: [ACTION:network]${JSON.stringify(nextPayload)}[/ACTION]`);
  }
  if (slice.length === 0) return lines.join('\n');

  lines.push('');
  slice.forEach((record) => {
    const entry = record.entry;
    const request = entry.request || {};
    const response = entry.response || {};
    const content = response.content || {};
    const status = response.status || 0;
    const time = Math.round(Number(entry.time) || 0);
    const type = getNetworkType(entry);
    const size = content.size || response.bodySize || 0;
    lines.push(`#${record.id} ${request.method || 'GET'} ${redactSensitiveText(request.url || '')} -> ${status} ${time}ms ${type} ${content.mimeType || ''} (${size} bytes)`);
  });
  return lines.join('\n');
}

function getNetworkContent(record, bodyLimit) {
  if (record.contentLoaded) return Promise.resolve(truncateText(record.content, bodyLimit));
  const entry = record.entry;
  if (!entry || typeof entry.getContent !== 'function') {
    const text = entry?.response?.content?.text || '';
    record.content = text;
    record.contentLoaded = true;
    return Promise.resolve(truncateText(text, bodyLimit));
  }

  return new Promise((resolve) => {
    try {
      entry.getContent((content, encoding) => {
        record.content = content || '';
        record.contentEncoding = encoding || '';
        record.contentLoaded = true;
        resolve(truncateText(record.content, bodyLimit));
      });
    } catch {
      record.contentLoaded = true;
      resolve('');
    }
  });
}

function formatInitiator(initiator) {
  if (!initiator) return '(unavailable)';
  try {
    return truncateText(JSON.stringify(initiator, null, 2), 4000);
  } catch {
    return String(initiator);
  }
}

async function formatNetworkDetail(record, options) {
  const entry = record.entry;
  const request = entry.request || {};
  const response = entry.response || {};
  const content = response.content || {};
  const responseText = await getNetworkContent(record, options.bodyLimit);
  const postText = request.postData && request.postData.text ? truncateText(request.postData.text, options.bodyLimit) : '';
  const timingText = entry.timings ? JSON.stringify(entry.timings, null, 2) : `(total ${Math.round(Number(entry.time) || 0)}ms)`;
  const lines = [
    `Request #${record.id}`,
    `${request.method || 'GET'} ${redactSensitiveText(request.url || '')}`,
    `Status: ${response.status || 0} ${response.statusText || ''}`.trim(),
    `Type: ${getNetworkType(entry)}`,
    `MIME: ${content.mimeType || '(unknown)'}`,
    `Size: ${content.size || response.bodySize || 0} bytes`,
    '',
    'Request Headers',
    formatHeaderList(request.headers),
  ];

  if (postText) {
    lines.push('', 'Post Data', redactSensitiveText(postText));
  }

  lines.push(
    '',
    'Response Headers',
    formatHeaderList(response.headers),
    '',
    'Timings',
    timingText,
    '',
    'Initiator',
    redactSensitiveText(formatInitiator(entry._initiator || entry.initiator)),
    '',
    'Response Preview',
    responseText ? redactSensitiveText(responseText) : '(response body unavailable)',
  );

  return lines.join('\n');
}

function formatManualCopyResult() {
  return t('copyManualReady');
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

function legacyGetNetworkHAR() {
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

async function legacyExecuteAction(type, code) {
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
      return executeFileAction('file_read', parseFileReadPayload(code));

    case 'project:scan':
      return executeFileAction('project_scan', {});

    default:
      return 'Unknown action: ' + type;
  }
}

async function getNetworkHAR(code = '') {
  await refreshNetworkRequestsFromHAR();
  const options = parseNetworkOptions(code);
  if (options.id && options.detail) {
    const record = networkRequests.find((item) => item.id === options.id);
    if (!record) return `Network request not found: ${options.id}`;
    return formatNetworkDetail(record, options);
  }
  return formatNetworkSummary(options);
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
      return executeDomAll(code);

    case 'text':
      return executeInspectedWindowEval(
        `(function(){ var el = document.querySelector(${JSON.stringify(code)}); return el ? el.textContent.trim() : 'Element not found: ${code}'; })()`
      );

    case 'console':
      return getConsoleLogs();

    case 'network':
      return getNetworkHAR(code);

    case 'title':
      return executeInspectedWindowEval('document.title');

    case 'url':
      return executeInspectedWindowEval('location.href');

    case 'copy':
      return formatManualCopyResult();

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
      return executeFileAction('file_read', parseFileReadPayload(code));

    case 'project:scan':
      return executeFileAction('project_scan', {});

    case 'storage:list':
      return executeStorageList(code.trim());

    case 'storage:get':
      return executeStorageGet(code);

    case 'storage:set':
      return executeStorageSet(code);

    case 'storage:remove':
      return executeStorageRemove(code);

    default:
      return 'Unknown action: ' + type;
  }
}

async function executeDomAll(code) {
  const options = parseDomAllOptions(code);
  const raw = await executeInspectedWindowEval(buildDomAllScript(options));
  if (typeof raw === 'object' && raw) {
    return formatDomAllResult(raw);
  }
  if (typeof raw === 'string') return raw;
  return formatDomAllResult({ ...options, total: 0, items: [] });
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
      var selector = ${JSON.stringify(selector)};
      var desiredValue = ${JSON.stringify(value)};
      var el = document.querySelector(selector);
      if (!el) return ${JSON.stringify(notFound)};

      function clean(text) {
        return String(text || '').replace(/\\s+/g, ' ').trim();
      }

      function nativeValueSetter(node) {
        var tag = (node.tagName || '').toLowerCase();
        var proto = tag === 'textarea'
          ? HTMLTextAreaElement.prototype
          : tag === 'select'
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
        var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        return descriptor && descriptor.set ? descriptor.set : null;
      }

      function setNativeValue(node, nextValue) {
        var setter = nativeValueSetter(node);
        if (setter) setter.call(node, nextValue);
        else node.value = nextValue;
      }

      function fire(node, type) {
        var event;
        if ((type === 'beforeinput' || type === 'input') && typeof InputEvent === 'function') {
          event = new InputEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            data: desiredValue,
            inputType: 'insertText'
          });
        } else {
          event = new Event(type, { bubbles: true, cancelable: true, composed: true });
        }
        node.dispatchEvent(event);
      }

      function setSelectValue(node, nextValue) {
        var options = Array.from(node.options || []);
        var match = options.find(function(option) {
          return option.value === nextValue || clean(option.textContent) === nextValue;
        });
        setNativeValue(node, match ? match.value : nextValue);
      }

      function selectEditableContents(node) {
        if (!window.getSelection || !document.createRange) return false;
        var range = document.createRange();
        range.selectNodeContents(node);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }

      function insertEditableText(node, nextValue) {
        node.focus();
        try {
          if (
            selectEditableContents(node) &&
            typeof document.execCommand === 'function' &&
            document.execCommand('insertText', false, nextValue)
          ) {
            return true;
          }
        } catch {
          // Fall through to the textContent fallback below.
        }
        if (node.textContent !== nextValue) node.textContent = nextValue;
        return false;
      }

      function setElementValue(node, nextValue) {
        var tag = (node.tagName || '').toLowerCase();
        var role = node.getAttribute ? node.getAttribute('role') : '';
        var isTextboxLike = node.isContentEditable || (!('value' in node) && role === 'textbox');
        if (isTextboxLike) {
          insertEditableText(node, nextValue);
          return;
        }
        if (tag === 'select') {
          setSelectValue(node, nextValue);
          return;
        }
        if ('value' in node) {
          setNativeValue(node, nextValue);
          return;
        }
        if (node.textContent !== nextValue) node.textContent = nextValue;
      }

      function currentValue(node) {
        var tag = (node.tagName || '').toLowerCase();
        if (tag === 'select') {
          var option = node.options && node.selectedIndex >= 0 ? node.options[node.selectedIndex] : null;
          return option ? { value: node.value, text: clean(option.textContent) } : { value: node.value, text: '' };
        }
        if ('value' in node) return { value: node.value, text: '' };
        return { value: clean(node.textContent), text: '' };
      }

      function valueMatches(node, nextValue) {
        var current = currentValue(node);
        return current.value === nextValue || current.text === nextValue;
      }

      var lastObserved = '';
      for (var attempt = 1; attempt <= 3; attempt += 1) {
        el.focus();
        setElementValue(el, desiredValue);
        fire(el, 'beforeinput');
        fire(el, 'input');
        fire(el, 'change');
        lastObserved = currentValue(el).value || currentValue(el).text;
        if (valueMatches(el, desiredValue)) {
          return ${JSON.stringify(typed)} + ' (attempt ' + attempt + ', observed "' + clean(lastObserved).slice(0, 120) + '")';
        }
      }

      return 'Input may not have stuck: ' + selector + ' (observed "' + clean(lastObserved).slice(0, 120) + '")';
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

function normalizeStorageArea(area) {
  const value = String(area || '').trim();
  return ['localStorage', 'sessionStorage', 'cookie'].includes(value) ? value : '';
}

function parseStoragePayload(code) {
  const payload = parseJsonPayload(code);
  return payload && !Array.isArray(payload) ? payload : null;
}

function executeStorageList(area) {
  const normalizedArea = normalizeStorageArea(area);
  if (!normalizedArea) return Promise.resolve('Invalid storage area. Use localStorage, sessionStorage, or cookie.');

  return executeInspectedWindowEval(`
    (function() {
      var area = ${JSON.stringify(normalizedArea)};
      if (area === 'cookie') {
        var cookies = document.cookie ? document.cookie.split(';').map(function(item) { return item.trim().split('=')[0]; }).filter(Boolean) : [];
        return 'cookie keys (' + cookies.length + '):\\n' + cookies.map(function(key) { return '- ' + decodeURIComponent(key); }).join('\\n');
      }
      var store = window[area];
      var keys = [];
      for (var i = 0; i < store.length; i++) keys.push(store.key(i));
      return area + ' keys (' + keys.length + '):\\n' + keys.map(function(key) { return '- ' + key; }).join('\\n');
    })()
  `);
}

function executeStorageGet(code) {
  const payload = parseStoragePayload(code);
  if (!payload) return Promise.resolve('Invalid storage:get payload. Use JSON with area and key.');
  const area = normalizeStorageArea(payload.area);
  const key = String(payload.key || '');
  if (!area || !key) return Promise.resolve('Invalid storage:get payload. Use area and key.');

  return executeInspectedWindowEval(`
    (function() {
      var area = ${JSON.stringify(area)};
      var key = ${JSON.stringify(key)};
      if (area === 'cookie') {
        var match = document.cookie.split(';').map(function(item) { return item.trim(); }).find(function(item) {
          return item.indexOf(encodeURIComponent(key) + '=') === 0 || item.indexOf(key + '=') === 0;
        });
        return match ? decodeURIComponent(match.substring(match.indexOf('=') + 1)) : '';
      }
      var value = window[area].getItem(key);
      return value === null ? '' : value;
    })()
  `);
}

function executeStorageSet(code) {
  const payload = parseStoragePayload(code);
  if (!payload) return Promise.resolve('Invalid storage:set payload. Use JSON with area, key, and value.');
  const area = normalizeStorageArea(payload.area);
  const key = String(payload.key || '');
  const value = String(payload.value ?? '');
  if (!area || !key) return Promise.resolve('Invalid storage:set payload. Use area and key.');

  return executeInspectedWindowEval(`
    (function() {
      var area = ${JSON.stringify(area)};
      var key = ${JSON.stringify(key)};
      var value = ${JSON.stringify(value)};
      if (area === 'cookie') {
        document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + '; path=/';
        return 'cookie updated: ' + key;
      }
      window[area].setItem(key, value);
      return area + ' updated: ' + key;
    })()
  `);
}

function executeStorageRemove(code) {
  const payload = parseStoragePayload(code);
  if (!payload) return Promise.resolve('Invalid storage:remove payload. Use JSON with area and key.');
  const area = normalizeStorageArea(payload.area);
  const key = String(payload.key || '');
  if (!area || !key) return Promise.resolve('Invalid storage:remove payload. Use area and key.');

  return executeInspectedWindowEval(`
    (function() {
      var area = ${JSON.stringify(area)};
      var key = ${JSON.stringify(key)};
      if (area === 'cookie') {
        document.cookie = encodeURIComponent(key) + '=; Max-Age=0; path=/';
        return 'cookie removed: ' + key;
      }
      window[area].removeItem(key);
      return area + ' removed: ' + key;
    })()
  `);
}

function executeInspectedWindowEval(code) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (isException) {
        resolve('Execution error: ' + (isException.value || isException));
      } else if (result && typeof result === 'object') {
        resolve(result);
      } else {
        resolve(result === undefined ? 'undefined' : String(result));
      }
    });
  });
}

function shouldCollectActionEvidence(type) {
  return EVIDENCE_ACTIONS.has(type);
}

function waitForActionEvidence() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const timer = setTimeout(finish, ACTION_EVIDENCE_DELAY_MS);
      if (timer === undefined) Promise.resolve().then(finish);
    } catch {
      finish();
    }
  });
}

function buildActionEvidenceScript() {
  return `
    (function() {
      function clean(value, max) {
        return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max || 240);
      }

      function isVisible(el) {
        if (!el || el.nodeType !== 1) return false;
        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (!rect || rect.width <= 0 || rect.height <= 0) return false;
        var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        return !style || (style.display !== 'none' && style.visibility !== 'hidden');
      }

      function describeElement(el) {
        if (!el || el.nodeType !== 1) return '';
        var tag = (el.tagName || '').toLowerCase();
        var label = tag;
        if (el.id) label += '#' + el.id;
        if (el.getAttribute) {
          var testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy');
          var name = el.getAttribute('name');
          var role = el.getAttribute('role');
          var aria = el.getAttribute('aria-label');
          if (testId) label += '[data-testid="' + clean(testId, 80) + '"]';
          if (name) label += '[name="' + clean(name, 80) + '"]';
          if (role) label += '[role="' + clean(role, 80) + '"]';
          if (aria) label += ' aria="' + clean(aria, 100) + '"';
        }

        var value = '';
        if (tag === 'select') {
          var selected = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
          value = selected ? clean(selected.textContent || selected.value, 120) : clean(el.value, 120);
        } else if ('value' in el) {
          value = clean(el.value, 120);
        } else if (el.isContentEditable || (el.getAttribute && el.getAttribute('role') === 'textbox')) {
          value = clean(el.textContent, 120);
        }

        var text = value ? '' : clean(el.innerText || el.textContent, 120);
        if (value) label += ' value="' + value + '"';
        else if (text) label += ' text="' + text + '"';
        return label;
      }

      var inputSelector = 'input, textarea, select, [contenteditable="true"], [role="textbox"]';
      var buttonSelector = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]';
      var inputs = Array.from(document.querySelectorAll(inputSelector)).filter(isVisible).slice(0, 8).map(describeElement);
      var buttons = Array.from(document.querySelectorAll(buttonSelector)).filter(isVisible).slice(0, 12).map(describeElement);

      return {
        url: location.href,
        title: document.title,
        textSample: clean(document.body ? (document.body.innerText || document.body.textContent) : '', 1200),
        active: describeElement(document.activeElement),
        inputs: inputs,
        buttons: buttons
      };
    })()
  `;
}

async function collectActionEvidence() {
  if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) {
    return null;
  }

  try {
    const result = await executeInspectedWindowEval(buildActionEvidenceScript());
    if (result && typeof result === 'object') return result;
    return result ? { error: String(result) } : null;
  } catch (error) {
    return { error: error && error.message ? error.message : String(error) };
  }
}

function actionEvidenceTextChanged(before, after) {
  if (!before || !after) return 'unknown';
  const beforeText = String(before.textSample || '');
  const afterText = String(after.textSample || '');
  return beforeText === afterText ? 'no' : 'yes';
}

function compactEvidenceValue(value, maxChars = 160) {
  const text = String(value || '');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 3)}...`;
}

function compactEvidenceList(items, limit, maxItemChars) {
  const values = items.slice(0, limit).map((item) => compactEvidenceValue(item, maxItemChars));
  if (items.length > limit) values.push(`+${items.length - limit} more`);
  return values.join(' | ');
}

function formatActionEvidence(before, after) {
  if (!after) return '';
  if (after.error) return `Verification evidence:\nEvidence collection failed: ${after.error}`;

  const lines = ['Verification evidence:'];
  if (before && before.url) {
    lines.push(before.url === after.url ? `URL: ${after.url} (unchanged)` : `URL: ${before.url} -> ${after.url}`);
  } else if (after.url) {
    lines.push(`URL: ${after.url}`);
  }

  lines.push(`Text changed: ${actionEvidenceTextChanged(before, after)}`);
  if (after.active) lines.push(`Active: ${compactEvidenceValue(after.active)}`);
  if (Array.isArray(after.inputs) && after.inputs.length > 0) {
    lines.push(`Inputs: ${compactEvidenceList(after.inputs, 3, 140)}`);
  }
  if (Array.isArray(after.buttons) && after.buttons.length > 0) {
    lines.push(`Buttons: ${compactEvidenceList(after.buttons, 4, 120)}`);
  }
  return lines.join('\n');
}

function formatActionResultWithEvidence(result, beforeEvidence, afterEvidence) {
  const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const evidenceText = formatActionEvidence(beforeEvidence, afterEvidence);
  if (!evidenceText) return resultText;
  return `Action result:\n${resultText}\n\n${evidenceText}`;
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

function startElementPicker() {
  const script = `
    (function() {
      if (window.__cc_picker_cleanup) window.__cc_picker_cleanup();
      window.__cc_picker_result = null;
      var overlay = document.createElement('div');
      overlay.setAttribute('data-cc-devtools-picker', '1');
      overlay.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'pointer-events:none',
        'border:2px solid #58c7b1',
        'background:rgba(88,199,177,0.12)',
        'box-shadow:0 0 0 99999px rgba(0,0,0,0.08)',
        'display:none'
      ].join(';');
      document.documentElement.appendChild(overlay);

      function cssEscape(value) {
        if (window.CSS && CSS.escape) return CSS.escape(value);
        return String(value).replace(/[^a-zA-Z0-9_-]/g, function(ch) { return '\\\\' + ch; });
      }

      function isUnique(selector) {
        try { return document.querySelectorAll(selector).length === 1; }
        catch(e) { return false; }
      }

      function addCandidate(list, selector) {
        if (selector && list.indexOf(selector) === -1 && isUnique(selector)) list.push(selector);
      }

      function nthOfType(el) {
        var index = 1;
        var sibling = el;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.tagName === el.tagName) index += 1;
        }
        return el.tagName.toLowerCase() + ':nth-of-type(' + index + ')';
      }

      function buildPath(el) {
        var parts = [];
        var node = el;
        while (node && node.nodeType === 1 && node !== document.documentElement) {
          if (node.id) {
            parts.unshift('#' + cssEscape(node.id));
            break;
          }
          parts.unshift(nthOfType(node));
          node = node.parentElement;
        }
        return parts.join(' > ');
      }

      function elementInfo(el) {
        var candidates = [];
        var tag = el.tagName.toLowerCase();
        if (el.id) addCandidate(candidates, '#' + cssEscape(el.id));
        ['data-testid','data-test','data-cy','aria-label','name','role','title'].forEach(function(name) {
          var value = el.getAttribute(name);
          if (value) addCandidate(candidates, tag + '[' + name + '="' + value.replace(/"/g, '\\\\"') + '"]');
        });
        addCandidate(candidates, buildPath(el));
        var rect = el.getBoundingClientRect();
        var attrs = {};
        ['id','class','name','type','role','aria-label','data-testid','href'].forEach(function(name) {
          var value = el.getAttribute(name);
          if (value) attrs[name] = value;
        });
        return {
          tag: tag,
          selectors: candidates,
          text: ((el.innerText || el.textContent || '') + '').replace(/\\s+/g, ' ').trim().slice(0, 240),
          role: el.getAttribute('role') || '',
          name: el.getAttribute('aria-label') || el.getAttribute('name') || '',
          attributes: attrs,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      }

      function cleanup() {
        document.removeEventListener('mousemove', onMove, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKey, true);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        window.__cc_picker_cleanup = null;
      }

      function show(el) {
        if (!el || el === overlay || el.closest('[data-cc-devtools-picker]')) return;
        var rect = el.getBoundingClientRect();
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.display = 'block';
      }

      function onMove(event) {
        show(event.target);
      }

      function onClick(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.__cc_picker_result = elementInfo(event.target);
        cleanup();
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          window.__cc_picker_result = { cancelled: true };
          cleanup();
        }
      }

      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
      window.__cc_picker_cleanup = cleanup;
      return 'armed';
    })()
  `;

  chrome.devtools.inspectedWindow.eval(script, (result, isException) => {
    if (isException) {
      addSystemMessage('Element picker failed: ' + (isException.value || isException));
      return;
    }
    addSystemMessage(t('pickArmed'));
    pollPickedElement(0);
  });
}

function pollPickedElement(attempt) {
  if (attempt > 120) {
    addSystemMessage(t('pickEmpty'));
    return;
  }
  chrome.devtools.inspectedWindow.eval('window.__cc_picker_result || null', (result) => {
    if (result) {
      chrome.devtools.inspectedWindow.eval('window.__cc_picker_result = null');
      if (result.cancelled) {
        addSystemMessage('Element picker cancelled.');
        return;
      }
      const message = formatPickedElement(result);
      if (ws && ws.readyState === WebSocket.OPEN) {
        send({ content: message });
      } else {
        addSystemMessage(message);
      }
      return;
    }
    pickPollTimer = setTimeout(() => pollPickedElement(attempt + 1), 250);
  });
}

function formatPickedElement(result) {
  const selectors = Array.isArray(result.selectors) && result.selectors.length > 0
    ? result.selectors.map((selector) => `- ${selector}`).join('\n')
    : '- (no unique selector found)';
  return [
    `${t('pickResultTitle')}: ${result.tag || '(unknown)'}`,
    `Text: ${result.text || ''}`,
    `Role: ${result.role || ''}`,
    `Name: ${result.name || ''}`,
    `Bounds: ${JSON.stringify(result.bounds || {})}`,
    'Selectors:',
    selectors,
    'Attributes:',
    JSON.stringify(result.attributes || {}, null, 2),
  ].join('\n');
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
  attachCopyButtons(div);

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
    if (type === 'copy') {
      manualCopyPayloads[placeholder] = code;
      htmlParts.push(`<div class="action-block action-copy"><div class="action-label">${t('action')} ${type}: ${escapeHtml(code.substring(0, 80))}</div><button type="button" class="copy-action-btn" data-copy-id="${placeholder}">Copy</button><pre class="copy-fallback">${escapeHtml(code)}</pre><span id="${placeholder}">${t('copyReady')}</span></div>`);
    } else {
      htmlParts.push(`<div class="action-block"><div class="action-label">${t('action')} ${type}: ${escapeHtml(code.substring(0, 80))}</div><span id="${placeholder}">${t('running')}</span></div>`);
    }
    lastIndex = actionRe.lastIndex;
  }

  htmlParts.push(formatMessageText(content.substring(lastIndex)));

  return { html: htmlParts.join(''), actions };
}

function attachCopyButtons(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('.copy-action-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-copy-id');
      const text = manualCopyPayloads[id] || '';
      const status = document.getElementById(id);
      try {
        await navigator.clipboard.writeText(text);
        if (status) status.textContent = t('copied');
      } catch {
        if (status) status.textContent = t('copyFailed');
      }
    });
  });
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
  if (actionRoundCount >= getConfiguredMaxActionRounds()) {
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
      const wantsEvidence = shouldCollectActionEvidence(a.type);
      const beforeEvidence = wantsEvidence ? await collectActionEvidence() : null;
      result = await executeAction(a.type, a.code);
      let afterEvidence = null;
      if (wantsEvidence) {
        await waitForActionEvidence();
        afterEvidence = await collectActionEvidence();
      }
      result = formatActionResultWithEvidence(result, beforeEvidence, afterEvidence);
    }
    const resultText = redactSensitiveText(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    const short = truncateText(resultText, actionResultMaxChars(a));

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

initBridgeTokenControl();
initActionRoundControl();
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
  resetTokenUsage();
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

if (pickBtn) {
  pickBtn.addEventListener('click', () => {
    if (pickPollTimer) clearTimeout(pickPollTimer);
    startElementPicker();
  });
}

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
    networkRequests = [];
    nextNetworkRequestId = 1;
    updatePageInfo();
    injectConsoleInterceptor();
  });
}

if (chrome.devtools.network && chrome.devtools.network.onRequestFinished) {
  chrome.devtools.network.onRequestFinished.addListener((entry) => {
    rememberNetworkRequest(entry);
  });
}

sendBtn.disabled = true;
connect();
injectConsoleInterceptor();
updatePageInfo();
