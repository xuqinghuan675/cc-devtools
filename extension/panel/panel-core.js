(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CCDevtoolsPanelCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const SCHEMA_VERSION = 1;
  const REDACTION_TEXT = '[redacted]';
  const PLAN_ALLOWED_ACTIONS = new Set([
    'dom',
    'dom:all',
    'text',
    'console',
    'network',
    'title',
    'url',
    'copy',
    'file:list',
    'project:scan',
    'storage:list',
    'storage:get',
  ]);
  const AUTO_CONFIRM_ACTIONS = new Set(['eval', 'save', 'file:read', 'storage:set', 'storage:remove']);
  const OBSERVE_ACTIONS = new Set(['dom', 'dom:all', 'text', 'console', 'network', 'title', 'url', 'copy']);
  const INTERACTION_ACTIONS = new Set(['click', 'input', 'press']);
  const STORAGE_READ_ACTIONS = new Set(['storage:list', 'storage:get']);
  const STORAGE_WRITE_ACTIONS = new Set(['storage:set', 'storage:remove']);
  const EVIDENCE_TYPES = ['console', 'network', 'dom', 'action', 'project', 'file', 'verification', 'manual'];
  const EVIDENCE_SEVERITIES = ['info', 'warning', 'error'];
  const RECORDER_EVENT_TYPES = ['click', 'press', 'input', 'route', 'title', 'console', 'network', 'storage', 'action'];
  const PATCH_STATUSES = ['draft', 'preview', 'applied', 'verifying', 'verified', 'failed', 'rolled_back', 'rollback_failed'];
  const DOM_DIAGNOSTIC_RESULTS = ['visible', 'clickable', 'covered', 'clipped', 'disabled', 'pointer-blocked'];
  const SCREENSHOT_STATUSES = ['supported', 'unsupported', 'permission_required', 'failed'];
  const PATCH_TRANSITIONS = {
    draft: ['preview'],
    preview: ['applied', 'failed'],
    applied: ['verifying', 'failed'],
    verifying: ['verified', 'failed'],
    failed: ['rolled_back', 'rollback_failed'],
    verified: [],
    rolled_back: [],
    rollback_failed: [],
  };
  const RECORDER_WINDOW_MS = 120000;
  const RECORDER_MAX_EVENTS = 300;
  const RECORDER_MAX_BYTES = 1024 * 1024;
  const GITHUB_ISSUE_HEADINGS = [
    '## Symptom',
    '## Reproduction Steps',
    '## Expected',
    '## Actual',
    '## Console Evidence',
    '## Network Evidence',
    '## Suspected Area',
    '## Environment',
    '## Evidence IDs',
  ];
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function redactSensitiveText(value) {
    return String(value ?? '')
      .replace(/([?&](?:access_token|id_token|token|auth|authorization|api[_-]?key|key|password|passwd|secret|session|cookie|csrf|jwt)=)([^&#\s]+)/gi, `$1${REDACTION_TEXT}`)
      .replace(/\b(authorization:\s*(?:bearer|basic)\s+)[^\s,;]+/gi, `$1${REDACTION_TEXT}`)
      .replace(/\b(cookie:\s*)[^\n]+/gi, `$1${REDACTION_TEXT}`)
      .replace(/(["'](?:access_token|id_token|token|auth|authorization|api[_-]?key|key|password|passwd|secret|session|cookie|csrf|jwt)["']\s*:\s*["'])[^"']+/gi, `$1${REDACTION_TEXT}`)
      .replace(/\b((?:access_token|id_token|token|auth|api[_-]?key|key|password|passwd|secret|session|cookie|csrf|jwt)\s*[:=]\s*)(["']?)[^\s,"';&]+/gi, `$1$2${REDACTION_TEXT}`);
  }

  function redactRecorderText(value) {
    return redactSensitiveText(value).replace(EMAIL_RE, REDACTION_TEXT);
  }

  function isSensitiveFieldName(name) {
    return /password|passwd|token|auth|authorization|api[_-]?key|\bkey\b|secret|session|cookie|csrf|jwt|email/i.test(String(name || ''));
  }

  function selectorSuggestsSensitiveField(selector) {
    return /\[(?:name|id|autocomplete|type|aria-label|data-testid|data-test)=["']?[^"'\]]*(?:password|passwd|token|secret|key|session|cookie|email)/i.test(String(selector || ''));
  }

  function estimateTextTokens(value) {
    const text = String(value ?? '');
    if (!text) return 0;
    const cjkMatches = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [];
    const nonCjk = text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, '');
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

  function sanitizeDisplayText(value) {
    return escapeHtml(redactSensitiveText(value));
  }

  function redactPayload(value, key = '') {
    if (isSensitiveFieldName(key)) return REDACTION_TEXT;
    if (typeof value === 'string') return redactRecorderText(value);
    if (Array.isArray(value)) return value.map((item) => redactPayload(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([entryKey, item]) => [entryKey, redactPayload(item, entryKey)]));
    }
    return value ?? null;
  }

  function createId(prefix) {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${time}_${random}`;
  }

  function createEvidenceItem(input = {}) {
    const type = EVIDENCE_TYPES.includes(input.type) ? input.type : 'manual';
    const severity = EVIDENCE_SEVERITIES.includes(input.severity) ? input.severity : 'info';
    return {
      schemaVersion: SCHEMA_VERSION,
      id: input.id || createId('ev'),
      createdAt: input.createdAt || new Date().toISOString(),
      pageUrl: redactSensitiveText(input.pageUrl || ''),
      pageTitle: sanitizeDisplayText(input.pageTitle || ''),
      type,
      severity,
      source: sanitizeDisplayText(input.source || type),
      title: sanitizeDisplayText(input.title || ''),
      summary: sanitizeDisplayText(input.summary || ''),
      payload: redactPayload(input.payload || {}),
      redacted: input.redacted !== false,
      selected: Boolean(input.selected),
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => sanitizeDisplayText(tag)) : [],
    };
  }

  function normalizeScreenshotStatus(status) {
    return SCREENSHOT_STATUSES.includes(status) ? status : 'unsupported';
  }

  function plainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return { ...value };
  }

  function plainArray(value) {
    return Array.isArray(value) ? value.map((item) => plainObject(item)) : [];
  }

  function truthyDisabledValue(value) {
    return value === true || String(value || '').toLowerCase() === 'true' || value === 'disabled';
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function hasPositiveRect(rect = {}) {
    const width = numberValue(rect.width);
    const height = numberValue(rect.height);
    return width !== null && height !== null && width > 0 && height > 0;
  }

  function isDisplayed(computedStyle = {}) {
    const display = String(computedStyle.display || '').toLowerCase();
    const visibility = String(computedStyle.visibility || '').toLowerCase();
    const opacity = numberValue(computedStyle.opacity);
    return display !== 'none'
      && visibility !== 'hidden'
      && visibility !== 'collapse'
      && (opacity === null || opacity > 0);
  }

  function topElementCoversTarget(topElementAtCenter = {}) {
    if (!topElementAtCenter || typeof topElementAtCenter !== 'object') return false;
    if (topElementAtCenter.matchesTarget === true || topElementAtCenter.containsTarget === true) return false;
    return Boolean(
      topElementAtCenter.matchesTarget === false
      || topElementAtCenter.containsTarget === false
      || topElementAtCenter.tag
      || topElementAtCenter.selector
    );
  }

  function centerIsClipped(input = {}) {
    const point = input.clickableCenterPoint || {};
    if (point.inViewport === false) return true;
    return plainArray(input.overflowClippingChain).some((item) => item.clipsCenter === true || item.clipped === true);
  }

  function classifyDomDiagnostic(input = {}) {
    if (DOM_DIAGNOSTIC_RESULTS.includes(input.diagnosticResult)) return input.diagnosticResult;
    const state = plainObject(input.state);
    const computedStyle = plainObject(input.computedStyle);
    const rect = plainObject(input.boundingClientRect);

    if (truthyDisabledValue(state.disabled) || truthyDisabledValue(state.ariaDisabled) || truthyDisabledValue(input.disabled) || truthyDisabledValue(input.ariaDisabled)) {
      return 'disabled';
    }
    if (String(computedStyle.pointerEvents || '').toLowerCase() === 'none') return 'pointer-blocked';
    if (centerIsClipped(input)) return 'clipped';
    if (topElementCoversTarget(input.topElementAtCenter)) return 'covered';
    if (isDisplayed(computedStyle) && hasPositiveRect(rect)) return 'clickable';
    return 'visible';
  }

  function createDomDiagnosticPayload(input = {}) {
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      selector: String(input.selector || ''),
      diagnosticResult: classifyDomDiagnostic(input),
      screenshotStatus: normalizeScreenshotStatus(input.screenshotStatus),
      element: plainObject(input.element),
      domSummary: String(input.domSummary || ''),
      boundingClientRect: plainObject(input.boundingClientRect),
      computedStyle: plainObject(input.computedStyle),
      state: plainObject(input.state),
      viewport: plainObject(input.viewport),
      overflowClippingChain: plainArray(input.overflowClippingChain),
      clickableCenterPoint: plainObject(input.clickableCenterPoint),
      topElementAtCenter: plainObject(input.topElementAtCenter),
    };
    if (input.error) payload.error = String(input.error);
    return payload;
  }

  function createDomDiagnosticEvidence(input = {}) {
    const payload = createDomDiagnosticPayload(input);
    const subject = payload.domSummary || payload.selector || payload.element.tag || 'element';
    const result = payload.diagnosticResult;
    return createEvidenceItem({
      id: input.id,
      type: 'dom',
      severity: result === 'clickable' || result === 'visible' ? 'info' : 'warning',
      source: 'visual-dom',
      title: `DOM diagnostic: ${subject}`,
      summary: `${result} | screenshot: ${payload.screenshotStatus}`,
      payload,
      selected: false,
      tags: ['visual', 'dom', 'diagnostic'],
    });
  }

  function evidenceSearchText(item) {
    return [
      item.id,
      item.type,
      item.severity,
      item.source,
      item.title,
      item.summary,
      Array.isArray(item.tags) ? item.tags.join(' ') : '',
      JSON.stringify(item.payload || {}),
    ].join(' ').toLowerCase();
  }

  function filterEvidenceItems(items, filters = {}) {
    const type = filters.type && filters.type !== 'all' ? filters.type : '';
    const query = String(filters.query || '').trim().toLowerCase();
    const selectedOnly = Boolean(filters.selectedOnly);
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (type && item.type !== type) return false;
      if (selectedOnly && !item.selected) return false;
      if (query && !evidenceSearchText(item).includes(query)) return false;
      return true;
    });
  }

  function getSelectedEvidence(items) {
    return (Array.isArray(items) ? items : []).filter((item) => item && item.selected);
  }

  function evidencePayloadText(payload) {
    if (payload === null || payload === undefined) return '';
    if (typeof payload === 'string') return payload;
    return JSON.stringify(payload, null, 2);
  }

  function hasFileContent(item) {
    if (!item || item.type !== 'file') return false;
    const payload = item.payload || {};
    return typeof payload.content === 'string' || typeof payload.text === 'string' || typeof payload.body === 'string';
  }

  function summarizeSelectedEvidence(items) {
    const selected = getSelectedEvidence(items);
    const summary = {
      evidenceCount: selected.length,
      consoleCount: selected.filter((item) => item.type === 'console').length,
      networkCount: selected.filter((item) => item.type === 'network').length,
      fileContentCount: selected.filter((item) => hasFileContent(item)).length,
      estimatedTokens: 0,
      redactionEnabled: selected.every((item) => item.redacted !== false),
      byType: {},
    };

    for (const item of selected) {
      summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
      summary.estimatedTokens += estimateValueTokens(item);
    }

    return summary;
  }

  function escapeMarkdownFence(text) {
    return String(text || '').replace(/```/g, "'''");
  }

  function formatEvidenceItemMarkdown(item) {
    const payload = evidencePayloadText(item.payload);
    const lines = [
      `### ${item.title || item.type || item.id}`,
      `- id: ${item.id}`,
      `- type: ${item.type}`,
      `- severity: ${item.severity}`,
      `- source: ${item.source || item.type}`,
      `- createdAt: ${item.createdAt}`,
    ];
    if (item.pageUrl) lines.push(`- pageUrl: ${item.pageUrl}`);
    if (item.tags && item.tags.length) lines.push(`- tags: ${item.tags.join(', ')}`);
    if (item.summary) lines.push('', item.summary);
    if (payload) lines.push('', '```json', escapeMarkdownFence(payload), '```');
    return lines.join('\n');
  }

  function buildSelectedEvidenceMessage(items) {
    const selected = getSelectedEvidence(items);
    return [
      'Use only the selected evidence below unless you need to ask for more.',
      '',
      '## Selected Evidence',
      '',
      selected.length ? selected.map(formatEvidenceItemMarkdown).join('\n\n') : '(none selected)',
    ].join('\n');
  }

  function formatEvidenceSendSummary(summary) {
    return [
      `Evidence: ${summary.evidenceCount}`,
      `Console: ${summary.consoleCount}`,
      `Network: ${summary.networkCount}`,
      `File content: ${summary.fileContentCount}`,
      `Estimated tokens: ${summary.estimatedTokens}`,
      `Redaction: ${summary.redactionEnabled ? 'enabled' : 'disabled'}`,
    ].join(' | ');
  }

  function createTrustPolicy(input = 'debug') {
    const options = typeof input === 'string' ? { mode: input } : { ...(input || {}) };
    const mode = options.mode || 'debug';
    const defaults = {
      observe: {
        canSendPageContext: true,
        canRunPageMutation: false,
        canRunEval: false,
        canReadFile: false,
        canWriteFile: false,
        requireSendPreview: true,
      },
      debug: {
        canSendPageContext: true,
        canRunPageMutation: true,
        canRunEval: true,
        canReadFile: false,
        canWriteFile: false,
        requireSendPreview: true,
      },
      patch: {
        canSendPageContext: true,
        canRunPageMutation: true,
        canRunEval: true,
        canReadFile: true,
        canWriteFile: true,
        requireSendPreview: true,
      },
      auto: {
        canSendPageContext: true,
        canRunPageMutation: true,
        canRunEval: true,
        canReadFile: true,
        canWriteFile: true,
        requireSendPreview: false,
      },
      plan: {
        canSendPageContext: true,
        canRunPageMutation: false,
        canRunEval: false,
        canReadFile: false,
        canWriteFile: false,
        requireSendPreview: true,
      },
      bypassPermissions: {
        canSendPageContext: true,
        canRunPageMutation: true,
        canRunEval: true,
        canReadFile: true,
        canWriteFile: true,
        requireSendPreview: false,
      },
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      mode,
      ...(defaults[mode] || defaults.debug),
      ...options,
    };
  }

  function decision(value, reason) {
    return { decision: value, reason: reason || value };
  }

  function canRunAction(policyInput, type) {
    const policy = createTrustPolicy(policyInput);
    const mode = policy.mode;

    if (mode === 'bypassPermissions') return decision('allow', 'legacy bypass mode');
    if (mode === 'plan') {
      return PLAN_ALLOWED_ACTIONS.has(type)
        ? decision('allow', 'legacy plan-safe action')
        : decision('block', 'legacy plan mode blocks mutation and execution');
    }
    if (mode === 'auto') {
      return AUTO_CONFIRM_ACTIONS.has(type)
        ? decision('confirm', 'legacy auto mode requires confirmation')
        : decision('allow', 'legacy auto-safe action');
    }

    if (OBSERVE_ACTIONS.has(type)) return decision('allow', 'read-only action');

    if (mode === 'observe') return decision('block', 'observe mode blocks mutation and privileged reads');

    if (INTERACTION_ACTIONS.has(type)) {
      return policy.canRunPageMutation ? decision('allow', 'page interaction allowed') : decision('block');
    }
    if (type === 'eval') {
      return policy.canRunEval ? decision('confirm', 'eval requires confirmation') : decision('block');
    }
    if (type === 'file:list' || type === 'project:scan') {
      return mode === 'debug' || mode === 'patch' ? decision('allow', 'project metadata read') : decision('block');
    }
    if (type === 'file:read') {
      if (mode === 'debug') return decision('confirm', 'file read requires confirmation');
      return policy.canReadFile ? decision('allow', 'file read allowed') : decision('block');
    }
    if (type === 'save') {
      return policy.canWriteFile ? decision('allow', 'file write allowed') : decision('block');
    }
    if (STORAGE_READ_ACTIONS.has(type)) {
      return mode === 'debug' || mode === 'patch' ? decision('allow', 'storage read allowed') : decision('block');
    }
    if (STORAGE_WRITE_ACTIONS.has(type)) {
      return mode === 'debug' || mode === 'patch' ? decision('confirm', 'storage mutation requires confirmation') : decision('block');
    }

    return decision('block', 'unknown action');
  }

  function estimateBytes(value) {
    return JSON.stringify(value || '').length;
  }

  function enforceStorageBudget(items, options = {}) {
    const maxItems = Math.max(1, Math.floor(Number(options.maxItems) || 100));
    const maxBytes = Math.max(1, Math.floor(Number(options.maxBytes) || 1024 * 1024));
    const sorted = Array.isArray(items) ? items.slice() : [];

    sorted.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    while (sorted.length > maxItems) sorted.shift();
    while (sorted.length > 1 && estimateBytes(sorted) > maxBytes) sorted.shift();
    return sorted;
  }

  function createStore(options = {}) {
    const config = {
      maxItems: options.maxItems || 100,
      maxBytes: options.maxBytes || 1024 * 1024,
    };
    let items = enforceStorageBudget(options.items || [], config);

    return {
      add(item) {
        items = enforceStorageBudget([...items, item], config);
        return item;
      },
      clear() {
        items = [];
      },
      list() {
        return items.slice();
      },
      import(nextItems) {
        items = enforceStorageBudget(nextItems, config);
      },
      export() {
        return JSON.stringify(items);
      },
    };
  }

  function parseTimeMs(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function truncateString(value, maxChars = 500) {
    const text = String(value ?? '');
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 3)}...`;
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of values || []) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
    }
    return result;
  }

  function normalizePatchStatus(status) {
    return PATCH_STATUSES.includes(status) ? status : 'draft';
  }

  function normalizePatchFiles(files) {
    return (Array.isArray(files) ? files : []).map((file) => ({
      path: String(file && file.path ? file.path : '').trim(),
      proposedContent: String(file && file.proposedContent !== undefined ? file.proposedContent : ''),
    })).filter((file) => file.path);
  }

  function normalizePatchVerification(verification = {}) {
    return {
      status: String(verification.status || 'not_started'),
      summary: String(verification.summary || ''),
      evidenceIds: uniqueStrings(verification.evidenceIds || []),
      updatedAt: String(verification.updatedAt || ''),
    };
  }

  function normalizePatchBackups(backups = {}) {
    const result = {};
    for (const [key, backup] of Object.entries(backups || {})) {
      const path = String((backup && backup.path) || key || '').trim();
      if (!path) continue;
      const content = String(backup && backup.content !== undefined ? backup.content : '');
      result[path] = {
        schemaVersion: SCHEMA_VERSION,
        path,
        content,
        contentLength: Number.isFinite(Number(backup && backup.contentLength)) ? Number(backup.contentLength) : content.length,
        createdAt: String((backup && backup.createdAt) || ''),
      };
    }
    return result;
  }

  function createPatchSession(input = {}) {
    const createdAt = input.createdAt || new Date().toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      id: input.id || createId('patch'),
      createdAt,
      updatedAt: input.updatedAt || createdAt,
      status: normalizePatchStatus(input.status),
      hypothesis: String(input.hypothesis || ''),
      files: normalizePatchFiles(input.files),
      backups: normalizePatchBackups(input.backups),
      diff: String(input.diff || ''),
      evidenceIds: uniqueStrings(input.evidenceIds || []),
      verification: normalizePatchVerification(input.verification),
    };
  }

  function canTransitionPatchStatus(fromStatus, toStatus) {
    const from = normalizePatchStatus(fromStatus);
    return (PATCH_TRANSITIONS[from] || []).includes(toStatus);
  }

  function transitionPatchSession(session, nextStatus, updates = {}) {
    const current = createPatchSession(session || {});
    if (!PATCH_STATUSES.includes(nextStatus)) {
      throw new Error(`Invalid patch status: ${nextStatus}`);
    }
    if (!canTransitionPatchStatus(current.status, nextStatus)) {
      throw new Error(`Invalid patch status transition: ${current.status} -> ${nextStatus}`);
    }
    const verification = updates.verification
      ? normalizePatchVerification({ ...current.verification, ...updates.verification })
      : current.verification;
    return createPatchSession({
      ...current,
      ...updates,
      status: nextStatus,
      updatedAt: updates.updatedAt || new Date().toISOString(),
      files: updates.files || current.files,
      backups: updates.backups || current.backups,
      evidenceIds: updates.evidenceIds || current.evidenceIds,
      verification,
    });
  }

  function splitPatchLines(content) {
    const text = String(content ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text) return [];
    const lines = text.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function buildPatchDiff(filePath, originalContent, proposedContent) {
    const path = String(filePath || '').trim() || '(unknown)';
    const before = splitPatchLines(originalContent);
    const after = splitPatchLines(proposedContent);
    const lines = [`--- ${path}`, `+++ ${path}`];
    const maxLines = Math.max(before.length, after.length);
    for (let index = 0; index < maxLines; index += 1) {
      const beforeLine = before[index];
      const afterLine = after[index];
      if (beforeLine === afterLine) {
        lines.push(` ${beforeLine || ''}`);
      } else {
        if (index < before.length) lines.push(`-${beforeLine || ''}`);
        if (index < after.length) lines.push(`+${afterLine || ''}`);
      }
    }
    return lines.join('\n');
  }

  function createPatchBackup(path, content, createdAt = '') {
    const backupContent = String(content ?? '');
    return {
      schemaVersion: SCHEMA_VERSION,
      path: String(path || '').trim(),
      content: backupContent,
      contentLength: backupContent.length,
      createdAt: createdAt || new Date().toISOString(),
    };
  }

  function previewPatchSession(session, preview = {}) {
    return transitionPatchSession(session, 'preview', {
      backups: preview.backups || {},
      diff: preview.diff || '',
    });
  }

  function summarizeInputValue(value, selector = '') {
    const text = String(value ?? '');
    const redacted = redactRecorderText(text) !== text || selectorSuggestsSensitiveField(selector);
    return {
      length: text.length,
      empty: text.length === 0,
      redacted,
    };
  }

  function sanitizeValueSummary(summary = {}, value = '', selector = '') {
    return {
      length: Math.max(0, Math.floor(Number(summary.length ?? String(value ?? '').length) || 0)),
      empty: Boolean(summary.empty ?? String(value ?? '').length === 0),
      redacted: Boolean(summary.redacted || summarizeInputValue(value, selector).redacted),
    };
  }

  function cleanRecorderText(value, maxChars = 500) {
    return truncateString(redactRecorderText(value).replace(/\s+/g, ' ').trim(), maxChars);
  }

  function sanitizeStorageKey(key) {
    const value = String(key || '');
    if (!value) return '';
    if (isSensitiveFieldName(value) || EMAIL_RE.test(value)) {
      EMAIL_RE.lastIndex = 0;
      return REDACTION_TEXT;
    }
    EMAIL_RE.lastIndex = 0;
    return cleanRecorderText(value, 160);
  }

  function sanitizeStorageChanges(changes = {}) {
    const result = {};
    for (const area of ['localStorage', 'sessionStorage', 'cookie']) {
      const change = changes[area] || {};
      const added = uniqueStrings((change.added || []).map(sanitizeStorageKey));
      const removed = uniqueStrings((change.removed || []).map(sanitizeStorageKey));
      if (added.length || removed.length) result[area] = { added, removed };
    }
    return result;
  }

  function createRecorderEvent(input = {}) {
    const type = RECORDER_EVENT_TYPES.includes(input.type) ? input.type : 'action';
    const event = {
      schemaVersion: SCHEMA_VERSION,
      id: input.id || createId('rec'),
      createdAt: input.createdAt || new Date().toISOString(),
      type,
    };

    if (input.pageUrl) event.pageUrl = cleanRecorderText(input.pageUrl, 1000);
    if (input.pageTitle) event.pageTitle = cleanRecorderText(input.pageTitle, 300);
    if (input.selector) event.selector = cleanRecorderText(input.selector, 300);
    if (input.evidenceId) event.evidenceId = cleanRecorderText(input.evidenceId, 160);
    if (input.summary) event.summary = cleanRecorderText(input.summary, 500);

    if (type === 'input') {
      event.valueSummary = sanitizeValueSummary(input.valueSummary || {}, input.value, input.selector);
    } else if (type === 'press') {
      event.key = cleanRecorderText(input.key || input.code || '', 80);
    } else if (type === 'route' || type === 'title') {
      event.from = cleanRecorderText(input.from || '', 1000);
      event.to = cleanRecorderText(input.to || '', 1000);
    } else if (type === 'storage') {
      event.storageChanges = sanitizeStorageChanges(input.storageChanges || {});
    } else if (type !== 'console' && type !== 'network' && input.payload !== undefined) {
      event.payload = redactPayload(input.payload);
    }

    if (!event.summary) event.summary = formatRecorderEventSummary(event);
    return event;
  }

  function enforceRecorderBudget(items, options = {}) {
    const maxItems = Math.max(1, Math.floor(Number(options.maxItems) || RECORDER_MAX_EVENTS));
    const maxBytes = Math.max(1, Math.floor(Number(options.maxBytes) || RECORDER_MAX_BYTES));
    const windowMs = Math.max(1, Math.floor(Number(options.windowMs) || RECORDER_WINDOW_MS));
    let sorted = Array.isArray(items) ? items.slice() : [];

    sorted.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const latestMs = sorted.reduce((latest, event) => Math.max(latest, parseTimeMs(event.createdAt)), 0);
    if (latestMs > 0) {
      const earliestMs = latestMs - windowMs;
      sorted = sorted.filter((event) => parseTimeMs(event.createdAt) >= earliestMs);
    }
    while (sorted.length > maxItems) sorted.shift();
    while (sorted.length > 1 && estimateBytes(sorted) > maxBytes) sorted.shift();
    return sorted;
  }

  function createRecorderStore(options = {}) {
    const config = {
      maxItems: options.maxItems || RECORDER_MAX_EVENTS,
      maxBytes: options.maxBytes || RECORDER_MAX_BYTES,
      windowMs: options.windowMs || RECORDER_WINDOW_MS,
    };
    let items = enforceRecorderBudget(options.items || [], config);
    let state = ['recording', 'paused', 'stopped'].includes(options.status) ? options.status : 'recording';

    function stats() {
      const list = items.slice();
      const start = list[0] ? list[0].createdAt : '';
      const end = list[list.length - 1] ? list[list.length - 1].createdAt : '';
      return {
        status: state,
        count: list.length,
        byteEstimate: estimateBytes(list),
        windowMs: config.windowMs,
        timeRange: { start, end },
      };
    }

    return {
      add(eventInput) {
        if (state !== 'recording') return null;
        const event = eventInput && eventInput.schemaVersion === SCHEMA_VERSION
          ? eventInput
          : createRecorderEvent(eventInput || {});
        items = enforceRecorderBudget([...items, event], config);
        return event;
      },
      clear() {
        items = [];
      },
      list() {
        return items.slice();
      },
      status() {
        return state;
      },
      pause() {
        state = 'paused';
      },
      resume() {
        state = 'recording';
      },
      stop() {
        state = 'stopped';
      },
      stats,
    };
  }

  function formatValueSummary(summary = {}) {
    if (summary.redacted) return `value redacted (${summary.length || 0} chars)`;
    if (summary.empty) return 'empty value';
    return `value length ${summary.length || 0}`;
  }

  function formatStorageChangeSummary(changes = {}) {
    const parts = [];
    for (const area of ['localStorage', 'sessionStorage', 'cookie']) {
      const change = changes[area] || {};
      if (change.added && change.added.length) parts.push(`${area} added: ${change.added.join(', ')}`);
      if (change.removed && change.removed.length) parts.push(`${area} removed: ${change.removed.join(', ')}`);
    }
    return parts.join(' | ') || 'Storage keys unchanged';
  }

  function formatRecorderEventSummary(event = {}) {
    switch (event.type) {
      case 'click':
        return `Click ${event.selector || '(unknown selector)'}`;
      case 'input':
        return `Input ${event.selector || '(unknown selector)'} (${formatValueSummary(event.valueSummary)})`;
      case 'press':
        return `Press ${event.key || '(unknown key)'}`;
      case 'route':
        return `Route changed: ${event.from || '(unknown)'} -> ${event.to || '(unknown)'}`;
      case 'title':
        return `Title changed: ${event.from || '(unknown)'} -> ${event.to || '(unknown)'}`;
      case 'console':
        return `Console: ${event.summary || event.evidenceId || '(summary unavailable)'}`;
      case 'network':
        return `Network: ${event.summary || event.evidenceId || '(summary unavailable)'}`;
      case 'storage':
        return formatStorageChangeSummary(event.storageChanges);
      default:
        return event.summary || `Action ${event.selector || event.evidenceId || event.id || ''}`.trim();
    }
  }

  function normalizeSnapshot(snapshot = {}) {
    const result = {};
    for (const area of ['localStorage', 'sessionStorage', 'cookie']) {
      result[area] = uniqueStrings(Array.isArray(snapshot[area]) ? snapshot[area] : []);
    }
    return result;
  }

  function diffStorageKeySnapshots(before, after) {
    const previous = normalizeSnapshot(before || {});
    const next = normalizeSnapshot(after || {});
    const changes = {};
    for (const area of ['localStorage', 'sessionStorage', 'cookie']) {
      const beforeSet = new Set(previous[area]);
      const afterSet = new Set(next[area]);
      const added = next[area].filter((key) => !beforeSet.has(key));
      const removed = previous[area].filter((key) => !afterSet.has(key));
      if (added.length || removed.length) {
        changes[area] = { added, removed };
      }
    }
    return sanitizeStorageChanges(changes);
  }

  function hasStorageChanges(changes = {}) {
    return ['localStorage', 'sessionStorage', 'cookie'].some((area) => {
      const change = changes[area] || {};
      return (change.added && change.added.length) || (change.removed && change.removed.length);
    });
  }

  function formatMarkdownList(items, emptyText = '(none)') {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (values.length === 0) return emptyText;
    return values.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  function buildGithubIssueMarkdown(bundle) {
    return [
      '## Symptom',
      bundle.title || '(describe the symptom)',
      '',
      '## Reproduction Steps',
      formatMarkdownList(bundle.reproductionSteps),
      '',
      '## Expected',
      '(expected behavior)',
      '',
      '## Actual',
      bundle.title || '(actual behavior)',
      '',
      '## Console Evidence',
      formatMarkdownList(bundle.consoleSummary),
      '',
      '## Network Evidence',
      formatMarkdownList(bundle.networkSummary),
      '',
      '## Suspected Area',
      '(unknown)',
      '',
      '## Environment',
      `- URL: ${bundle.pageUrl || '(unknown)'}`,
      `- Title: ${bundle.pageTitle || '(unknown)'}`,
      `- Created: ${bundle.createdAt || '(unknown)'}`,
      `- Time range: ${(bundle.timeRange && bundle.timeRange.start) || '(unknown)'} -> ${(bundle.timeRange && bundle.timeRange.end) || '(unknown)'}`,
      '',
      '## Evidence IDs',
      formatMarkdownList(bundle.evidenceIds, '(none)'),
    ].join('\n');
  }

  function createBugBundle(input = {}) {
    const events = (Array.isArray(input.events) ? input.events : []).map((event) => (
      event && event.schemaVersion === SCHEMA_VERSION ? event : createRecorderEvent(event || {})
    ));
    const first = events[0] || {};
    const last = events[events.length - 1] || first;
    const reproductionEvents = events.filter((event) => ['click', 'input', 'press', 'route', 'title', 'storage'].includes(event.type));
    const consoleEvents = events.filter((event) => event.type === 'console');
    const networkEvents = events.filter((event) => event.type === 'network');

    const bundle = {
      schemaVersion: SCHEMA_VERSION,
      id: input.id || createId('bug'),
      createdAt: input.createdAt || new Date().toISOString(),
      title: cleanRecorderText(input.title || 'Bug report', 200),
      pageUrl: cleanRecorderText(input.pageUrl || last.pageUrl || first.pageUrl || '', 1000),
      pageTitle: cleanRecorderText(input.pageTitle || last.pageTitle || first.pageTitle || '', 300),
      timeRange: {
        start: first.createdAt || '',
        end: last.createdAt || '',
      },
      reproductionSteps: reproductionEvents.map(formatRecorderEventSummary),
      evidenceIds: uniqueStrings(events.map((event) => event.evidenceId)),
      consoleSummary: consoleEvents.map((event) => event.summary || formatRecorderEventSummary(event)),
      networkSummary: networkEvents.map((event) => event.summary || formatRecorderEventSummary(event)),
      selectors: uniqueStrings(events.map((event) => event.selector)),
      githubIssueMarkdown: '',
      playwrightDraft: input.playwrightDraft || '',
    };
    bundle.githubIssueMarkdown = buildGithubIssueMarkdown(bundle);
    return bundle;
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function matchSelectorAttribute(selector, names) {
    for (const name of names) {
      const pattern = new RegExp(`\\[${escapeRegExp(name)}\\s*=\\s*["']?([^"'\\]]+)`, 'i');
      const match = String(selector || '').match(pattern);
      if (match && match[1]) return { name, value: cleanRecorderText(match[1], 120) };
    }
    return null;
  }

  function quoteJsString(value) {
    return `'${String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')}'`;
  }

  function getSelectorConfidence(rawSelector = '') {
    const selector = cleanRecorderText(rawSelector, 400);
    const lower = selector.toLowerCase();
    const longSelector = selector.length > 120;
    const structural = /(?:^|[\s>+~])(?:html|body|main|div|section|article|span|button|input):nth-child\(/i.test(selector)
      || (selector.match(/\s>\s/g) || []).length >= 3;
    const result = {
      selector,
      level: 'fragile',
      score: 0.2,
      strategy: 'css',
      locator: selector ? `page.locator(${quoteJsString(selector)})` : '',
      fragile: true,
      reason: 'CSS-only selector',
    };

    const role = matchSelectorAttribute(selector, ['role', 'aria-role']);
    const textMatch = selector.match(/^text=(.+)$/i) || selector.match(/:has-text\(["']([^"']+)["']\)/i);
    const testId = matchSelectorAttribute(selector, ['data-testid', 'data-test', 'data-cy']);
    const name = matchSelectorAttribute(selector, ['name', 'aria-label']);
    const idMatch = selector.match(/^#([A-Za-z][\w-]*)$/) || selector.match(/^[a-z][\w-]*#([A-Za-z][\w-]*)$/i);

    if (role) {
      return {
        selector,
        level: longSelector ? 'medium' : 'high',
        score: longSelector ? 0.72 : 0.9,
        strategy: 'role',
        locator: `page.getByRole(${quoteJsString(role.value)})`,
        fragile: false,
        reason: 'Role selector',
      };
    }
    if (textMatch && textMatch[1]) {
      const text = cleanRecorderText(textMatch[1], 120);
      return {
        selector,
        level: 'high',
        score: 0.86,
        strategy: 'text',
        locator: `page.getByText(${quoteJsString(text)})`,
        fragile: false,
        reason: 'Text selector',
      };
    }
    if (testId) {
      return {
        selector,
        level: longSelector ? 'medium' : 'high',
        score: longSelector ? 0.72 : 0.88,
        strategy: 'testid',
        locator: `page.getByTestId(${quoteJsString(testId.value)})`,
        fragile: false,
        reason: `${testId.name} selector`,
      };
    }
    if (name) {
      return {
        selector,
        level: longSelector ? 'fragile' : 'medium',
        score: longSelector ? 0.45 : 0.68,
        strategy: name.name === 'aria-label' ? 'label' : 'name',
        locator: `page.locator(${quoteJsString(selector)})`,
        fragile: longSelector,
        reason: `${name.name} selector`,
      };
    }
    if (idMatch && idMatch[1]) {
      return {
        selector,
        level: 'medium',
        score: 0.65,
        strategy: 'id',
        locator: `page.locator(${quoteJsString(selector)})`,
        fragile: false,
        reason: 'ID selector',
      };
    }
    if (longSelector || structural || lower.includes('nth-child')) {
      return {
        ...result,
        level: 'fragile',
        score: 0.15,
        fragile: true,
        reason: longSelector ? 'Long CSS selector' : 'Structural CSS selector',
      };
    }
    return result;
  }

  function parseInputActionCode(code) {
    const text = String(code || '');
    const nl = text.indexOf('\n');
    return {
      selector: nl > 0 ? text.substring(0, nl).trim() : text.trim(),
      value: nl > 0 ? text.substring(nl + 1) : '',
    };
  }

  function selectedDraftEvidence(items) {
    return getSelectedEvidence(items).filter((item) => item && item.payload && item.payload.actionType);
  }

  function sanitizedPlaywrightValue(value, selector = '') {
    const text = String(value ?? '');
    if (summarizeInputValue(text, selector).redacted) return REDACTION_TEXT;
    return cleanRecorderText(text, 240);
  }

  function actionToPlaywrightLine(item) {
    const payload = item.payload || {};
    const type = String(payload.actionType || '').trim();
    const code = String(payload.code || '');
    if (type === 'click') {
      const selector = cleanRecorderText(code.trim(), 400);
      if (!selector) return null;
      return {
        selector,
        line: `  await page.click(${quoteJsString(selector)});`,
      };
    }
    if (type === 'input') {
      const parsed = parseInputActionCode(code);
      const selector = cleanRecorderText(parsed.selector, 400);
      if (!selector) return null;
      const value = sanitizedPlaywrightValue(parsed.value, selector);
      return {
        selector,
        line: `  await page.fill(${quoteJsString(selector)}, ${quoteJsString(value)});`,
      };
    }
    if (type === 'press') {
      const key = cleanRecorderText(code.trim() || 'Enter', 80);
      return {
        selector: 'body',
        line: `  await page.press('body', ${quoteJsString(key)});`,
      };
    }
    return null;
  }

  function assertionTextFromEvidence(item) {
    const payload = item && item.payload ? item.payload : {};
    const parts = [item && item.summary, payload.result].filter(Boolean).map((value) => cleanRecorderText(value, 220));
    const candidates = uniqueStrings(parts)
      .map((text) => text.replace(/^Action result:\s*/i, '').replace(/^Verification evidence:\s*/i, '').trim())
      .filter((text) => text && text !== REDACTION_TEXT)
      .slice(0, 3);
    return candidates;
  }

  function assertionLinesFromEvidence(items) {
    const assertions = [];
    for (const item of items) {
      for (const text of assertionTextFromEvidence(item)) {
        assertions.push(`  await expect(page.getByText(${quoteJsString(text)})).toBeVisible();`);
      }
    }
    const seen = new Set();
    const result = [];
    for (const assertion of assertions) {
      if (seen.has(assertion)) continue;
      seen.add(assertion);
      result.push(assertion);
    }
    return result.slice(0, 5);
  }

  function createGeneratedTestDraft(input = {}) {
    const evidenceItems = selectedDraftEvidence(Array.isArray(input.evidenceItems) ? input.evidenceItems : []);
    const actionLines = [];
    const selectorConfidence = [];

    for (const item of evidenceItems) {
      const action = actionToPlaywrightLine(item);
      if (!action) continue;
      actionLines.push(action.line);
      selectorConfidence.push(getSelectorConfidence(action.selector));
    }

    const assertions = assertionLinesFromEvidence(evidenceItems);
    const body = actionLines.length ? actionLines : ['  // Add page actions from selected evidence.'];
    const testCode = [
      "import { test, expect } from '@playwright/test';",
      '',
      "test('generated from cc-devtools evidence', async ({ page }) => {",
      '  // TODO: Set the target URL before running this test.',
      ...body,
      ...(assertions.length ? ['', '  // Suggested assertions from evidence:', ...assertions] : []),
      '});',
    ].join('\n');

    return {
      schemaVersion: SCHEMA_VERSION,
      id: input.id || createId('testdraft'),
      createdAt: input.createdAt || new Date().toISOString(),
      sourceEvidenceIds: uniqueStrings(evidenceItems.map((item) => item.id)),
      sourceBugBundleId: input.sourceBugBundleId || '',
      selectorConfidence,
      assertions,
      testCode,
    };
  }

  return {
    SCHEMA_VERSION,
    EVIDENCE_TYPES,
    RECORDER_EVENT_TYPES,
    PATCH_STATUSES,
    DOM_DIAGNOSTIC_RESULTS,
    SCREENSHOT_STATUSES,
    RECORDER_WINDOW_MS,
    RECORDER_MAX_EVENTS,
    RECORDER_MAX_BYTES,
    GITHUB_ISSUE_HEADINGS,
    createEvidenceItem,
    redactSensitiveText,
    redactRecorderText,
    escapeHtml,
    estimateTextTokens,
    estimateValueTokens,
    createTrustPolicy,
    canRunAction,
    createStore,
    enforceStorageBudget,
    filterEvidenceItems,
    getSelectedEvidence,
    summarizeSelectedEvidence,
    formatEvidenceItemMarkdown,
    buildSelectedEvidenceMessage,
    formatEvidenceSendSummary,
    createRecorderEvent,
    createRecorderStore,
    enforceRecorderBudget,
    formatRecorderEventSummary,
    summarizeInputValue,
    diffStorageKeySnapshots,
    hasStorageChanges,
    createBugBundle,
    buildGithubIssueMarkdown,
    getSelectorConfidence,
    createGeneratedTestDraft,
    createPatchSession,
    canTransitionPatchStatus,
    transitionPatchSession,
    buildPatchDiff,
    createPatchBackup,
    previewPatchSession,
    normalizeScreenshotStatus,
    classifyDomDiagnostic,
    createDomDiagnosticPayload,
    createDomDiagnosticEvidence,
  };
});
