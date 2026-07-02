import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

function visibleBase(overrides = {}) {
  return {
    selector: 'button[data-testid="save"]',
    boundingClientRect: { x: 20, y: 30, width: 120, height: 40, top: 30, right: 140, bottom: 70, left: 20 },
    computedStyle: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto',
      zIndex: '10',
    },
    state: { disabled: false, ariaDisabled: false },
    viewport: { width: 1280, height: 720 },
    clickableCenterPoint: { x: 80, y: 50, inViewport: true },
    topElementAtCenter: { tag: 'button', matchesTarget: true, containsTarget: false },
    overflowClippingChain: [],
    ...overrides,
  };
}

test('DOM diagnostics classify disabled, blocked, clipped, covered, and clickable elements', () => {
  assert.equal(core.classifyDomDiagnostic(visibleBase({ state: { disabled: true, ariaDisabled: false } })), 'disabled');
  assert.equal(core.classifyDomDiagnostic(visibleBase({ state: { disabled: false, ariaDisabled: true } })), 'disabled');
  assert.equal(core.classifyDomDiagnostic(visibleBase({ computedStyle: { ...visibleBase().computedStyle, pointerEvents: 'none' } })), 'pointer-blocked');
  assert.equal(core.classifyDomDiagnostic(visibleBase({ clickableCenterPoint: { x: 1400, y: 900, inViewport: false } })), 'clipped');
  assert.equal(core.classifyDomDiagnostic(visibleBase({ overflowClippingChain: [{ tag: 'div', clipsCenter: true }] })), 'clipped');
  assert.equal(core.classifyDomDiagnostic(visibleBase({ topElementAtCenter: { tag: 'div', matchesTarget: false, containsTarget: false } })), 'covered');
  assert.equal(core.classifyDomDiagnostic(visibleBase()), 'clickable');
});

test('DOM diagnostics normalize screenshot capability status', () => {
  assert.equal(core.normalizeScreenshotStatus('supported'), 'supported');
  assert.equal(core.normalizeScreenshotStatus('permission_required'), 'permission_required');
  assert.equal(core.normalizeScreenshotStatus('failed'), 'failed');
  assert.equal(core.normalizeScreenshotStatus('anything else'), 'unsupported');
  assert.equal(core.normalizeScreenshotStatus(), 'unsupported');
});

test('DOM diagnostic evidence is structured, redacted, and unselected by default', () => {
  const evidence = core.createDomDiagnosticEvidence(visibleBase({
    id: 'domdiag_1',
    selector: 'a[href="/reset?token=abc123"]',
    element: {
      tag: 'a',
      id: 'danger',
      text: 'Reset person@example.com',
      attributes: {
        href: 'https://app.test/reset?token=abc123&next=/home',
        'data-token': 'secret-value',
      },
    },
    screenshotStatus: 'failed',
  }));

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.type, 'dom');
  assert.equal(evidence.selected, false);
  assert.equal(evidence.payload.schemaVersion, 1);
  assert.equal(evidence.payload.diagnosticResult, 'clickable');
  assert.equal(evidence.payload.screenshotStatus, 'failed');
  assert.equal(evidence.payload.boundingClientRect.width, 120);
  assert.equal(evidence.payload.computedStyle.pointerEvents, 'auto');
  assert.equal(evidence.payload.element.attributes['data-token'], '[redacted]');
  assert.doesNotMatch(JSON.stringify(evidence), /abc123|secret-value|person@example\.com/);
});
