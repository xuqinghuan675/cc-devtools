# Use Cases

cc-devtools is built for frontend developers who want an AI agent to use DevTools evidence instead of guessing from screenshots or pasted logs.

The Workbench is implemented as a complete local debugging loop: Chat, Evidence, Recorder, Visual, Patch, Tests, Trust, and Recipes work together around the same action protocol.

## 1. Inspect a Page

Ask:

```text
What is on this page? Identify the main user flows and important selectors.
```

The agent should collect title, URL, visible text, DOM snippets, console logs, and network summaries before summarizing. When local source context matters, it should also scan the frontend project to identify framework, bundler, scripts, config files, key directories, entry files, and data/service candidates.

## 2. Build an Evidence Board

Use **Evidence** when a bug needs traceable facts rather than a free-form chat transcript.

Typical flow:

1. Run actions such as `[ACTION:console][/ACTION]`, `[ACTION:network][/ACTION]`, `[ACTION:dom]selector[/ACTION]`, and `[ACTION:file:read]path[/ACTION]`.
2. Inspect the generated evidence cards.
3. Select only the cards that matter.
4. Click **Copy selected** or **Send selected**.
5. Confirm the redacted Send Preview before sending selected evidence.

This keeps selected user evidence separate from automatically attached page context.

## 3. Debug a Broken Page

Ask:

```text
The Save button does nothing. Diagnose it with console, network, and DOM evidence.
```

For interactive failures, the agent can click the button, type into fields, press keys, then collect console/network evidence again.

Expected output:

- Symptom
- Evidence IDs
- Likely cause
- Smallest fix
- Verification step

## 4. Record a Bug Flight

Use **Recorder** when you want a bounded event trail for a bug report.

The recorder stores a 2-minute / 300-event / 1 MB ring buffer. It records clicks, key presses, route/title changes, summarized input events, console/network summaries, and storage key diffs. Input values are summarized and sensitive fields are redacted.

Click **Pack bug bundle** to create a BugBundle with:

- Symptom
- Reproduction Steps
- Expected
- Actual
- Console Evidence
- Network Evidence
- Suspected Area
- Environment
- Evidence IDs

## 5. Generate a Playwright Draft

Use **Tests** after recording or selecting action evidence.

Ask:

```text
Turn the selected reproduction evidence into a Playwright test draft.
```

The first version generates a copy-only draft from selected action evidence and assertions. It does not write test files. Selector confidence is shown so fragile selectors are visible.

## 6. Preview a Patch Transaction

Use **Patch** when the fix is a known file path plus complete replacement content.

The page runs a conservative state machine:

```text
draft -> preview -> applied -> verifying -> verified
                     -> failed -> rolled_back
```

It reads a backup, displays a diff preview, applies through the existing file-write path, supports manual verification notes, and can rollback from the backup.

This first version intentionally avoids AST patches, multi-file merges, git worktrees, and auto commits.

## 7. Diagnose DOM Clickability

Use **Visual** when a control looks visible but does not behave correctly.

Enter a CSS selector and diagnose:

- element DOM summary
- `boundingClientRect`
- computed style
- display/visibility/opacity/pointer-events
- disabled and aria-disabled state
- overflow clipping chain
- clickable center point
- top element returned by `elementFromPoint`
- screenshot capability status

The first version is DOM-first and does not require screenshot permissions.

## 8. Choose a Trust Mode

Use **Trust** before switching from observation to mutation.

| Mode | Use it when |
|---|---|
| Observe Only | You only want page, console, network, DOM, and URL/title observation. |
| Debug Safe | You want click/input/press and safe project metadata, but not file writes. |
| Patch Sandbox | You are in a trusted local project root and want patch transactions. |

The page also shows the latest Send Preview so you can audit what is about to leave the panel. Ordinary Chat sends update this preview without interrupting the chat flow; selected evidence, BugBundles, test drafts, patch/file content, and Observe Only page-context sends require confirmation.

## 9. Keep Project Recipes

Use **Recipes** for repeated workflows and project-specific memory.

Recipe fields:

- name
- description
- tags
- workflow
- prompt template
- evidence types
- action plan

Project Memory buckets:

- ignored console patterns
- known selectors
- common flows
- API contracts
- QA checklists

The first version is manual import/export only. It does not automatically learn from your project and does not write memory files to disk.

## 10. Generate Stable Selectors

Ask:

```text
Generate a Playwright locator for the checkout submit button and verify it is unique.
```

The agent should prefer user-facing locators, labels, role/name, and test IDs before fragile class chains. The Tests page will also show selector confidence for generated draft actions.

## 11. QA a Page Before Release

Ask:

```text
Run a quick QA pass on this page. Focus on broken controls, failed requests, empty states, and obvious layout issues.
```

Expected output:

- Blocking issues first
- Evidence from DevTools actions
- Non-blocking polish separately
- Optional BugBundle or generated Playwright draft if a bug is reproducible

## 12. Frontend Loop Demo

Ask on the bundled `examples/country-selector-loop` page:

```text
Add Singapore to the country selector. Use the local JSON file, then select it and verify it in the page.
```

The agent should:

1. Inspect the live page.
2. Use the automatically attached local project context.
3. Read the country JSON file.
4. Save the new country.
5. Reload data or refresh the page.
6. Select Singapore.
7. Click Verify.
8. Report `#verification-output` as proof.

This is the shortest demo of cc-devtools' differentiator: DevTools evidence, local source awareness, disk writes, and browser verification in one F12 Workbench.

## What cc-devtools Is Not

- It is not a replacement for browser automation frameworks.
- It is not a security scanner.
- It does not bypass auth, captchas, paywalls, or platform limits.
- It should not be used on sensitive production sessions unless you trust both the page and your CLI AI provider.
