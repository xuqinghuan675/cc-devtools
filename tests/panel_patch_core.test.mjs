import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

test('PatchSession starts as schemaVersion 1 draft with required fields', () => {
  const session = core.createPatchSession({
    id: 'patch_1',
    createdAt: '2026-07-02T00:00:00.000Z',
    hypothesis: 'Update a known local fixture',
    files: [{ path: 'src/fixture.txt', proposedContent: 'after\n' }],
    evidenceIds: ['ev_1'],
  });

  assert.equal(session.schemaVersion, 1);
  assert.equal(session.id, 'patch_1');
  assert.equal(session.status, 'draft');
  assert.equal(session.hypothesis, 'Update a known local fixture');
  assert.deepEqual(session.files, [{ path: 'src/fixture.txt', proposedContent: 'after\n' }]);
  assert.deepEqual(session.backups, {});
  assert.equal(session.diff, '');
  assert.deepEqual(session.evidenceIds, ['ev_1']);
  assert.deepEqual(session.verification, {
    status: 'not_started',
    summary: '',
    evidenceIds: [],
    updatedAt: '',
  });
});

test('PatchSession enforces the patch transaction state machine', () => {
  let session = core.createPatchSession();
  session = core.transitionPatchSession(session, 'preview');
  session = core.transitionPatchSession(session, 'applied');
  session = core.transitionPatchSession(session, 'verifying');
  session = core.transitionPatchSession(session, 'verified', {
    verification: { status: 'verified', summary: 'Checked manually', evidenceIds: ['ev_verified'], updatedAt: 'now' },
  });

  assert.equal(session.status, 'verified');
  assert.deepEqual(session.verification.evidenceIds, ['ev_verified']);

  assert.throws(
    () => core.transitionPatchSession(core.createPatchSession(), 'applied'),
    /Invalid patch status transition: draft -> applied/,
  );

  let failed = core.transitionPatchSession(core.createPatchSession(), 'preview');
  failed = core.transitionPatchSession(failed, 'failed', { verification: { status: 'failed', summary: 'write denied' } });
  assert.equal(core.transitionPatchSession(failed, 'rolled_back').status, 'rolled_back');
  assert.equal(core.transitionPatchSession(failed, 'rollback_failed').status, 'rollback_failed');
});

test('PatchSession builds a safe text diff preview', () => {
  const diff = core.buildPatchDiff('src/fixture.txt', 'one\ntwo\n', 'one\nthree\nfour\n');

  assert.match(diff, /--- src\/fixture\.txt/);
  assert.match(diff, /\+\+\+ src\/fixture\.txt/);
  assert.match(diff, / one/);
  assert.match(diff, /-two/);
  assert.match(diff, /\+three/);
  assert.match(diff, /\+four/);
});

test('PatchSession preview captures backup and rollback data shape', () => {
  const backup = core.createPatchBackup('src/fixture.txt', 'before\n');
  const session = core.previewPatchSession(
    core.createPatchSession({
      files: [{ path: 'src/fixture.txt', proposedContent: 'after\n' }],
    }),
    {
      backups: { [backup.path]: backup },
      diff: core.buildPatchDiff('src/fixture.txt', backup.content, 'after\n'),
    },
  );

  assert.equal(session.status, 'preview');
  assert.equal(session.backups['src/fixture.txt'].schemaVersion, 1);
  assert.equal(session.backups['src/fixture.txt'].path, 'src/fixture.txt');
  assert.equal(session.backups['src/fixture.txt'].content, 'before\n');
  assert.equal(session.backups['src/fixture.txt'].contentLength, 7);
  assert.match(session.diff, /-before/);
  assert.match(session.diff, /\+after/);
});
