# Security Policy

cc-devtools gives a CLI AI tool controlled access to browser DevTools actions. Treat it as a local developer tool, not as a sandbox for untrusted pages.

## Supported Versions

The project is in early alpha. Security fixes target the latest `main` branch until versioned releases begin.

## What Data Is Sent to the CLI AI

Depending on the action and workflow, cc-devtools may send:

- Page URL and title
- Visible page text
- DOM snippets
- Console logs
- Network request summaries
- Action results
- Local project file contents read through `[ACTION:file:read]`

Your configured CLI AI command decides where model inference happens. cc-devtools itself does not require an API key.

## Local File Boundary

The actions below are restricted to `CC_DEVTOOLS_WRITE_ROOT`, or to the directory where the bridge was started:

- `[ACTION:file:list]`
- `[ACTION:file:read]`
- `[ACTION:save]`

Do not set `CC_DEVTOOLS_WRITE_ROOT` to your home directory or drive root.

Local writes are disabled by default in both bridge implementations. `[ACTION:save]` and `write_file` require `CC_DEVTOOLS_ENABLE_WRITE=1`; changing the panel permission mode does not enable file writes.

The Windows installer generates a random `CC_DEVTOOLS_TOKEN`, writes it into `start-bridge.bat`, and expects the same token to be saved in the DevTools panel. If you start either bridge manually, set `CC_DEVTOOLS_TOKEN` yourself for the same shared-token check.

## CLI Permission Boundary

The DevTools panel sends an explicit CLI permission mode with each message:

- `auto` is the default.
- `plan` asks the CLI to stay in planning mode.
- `bypassPermissions` must be selected explicitly and should only be used in trusted disposable sandboxes.

If an older panel does not send a mode, the bridge defaults to `auto`. `CC_DEVTOOLS_PERMISSION_MODE` can set that fallback default, and `CC_DEVTOOLS_BYPASS=1` is retained only as a legacy fallback for `bypassPermissions`.

Panel action execution is intentionally a soft guardrail:

- Read-only actions run automatically.
- `click`, `input`, and `press` run automatically in Auto mode so live frontend verification stays fast.
- `eval`, `save`, and `file:read` ask for panel confirmation in Auto mode.
- Plan mode blocks mutating or code-execution actions.
- Bypass mode skips panel confirmation but still respects bridge write-root checks, sensitive-file rejection, and `CC_DEVTOOLS_ENABLE_WRITE`.

## Prompt-Injection Boundary

Browser-originated context is sent as untrusted data. The bridge adds an explicit instruction that page text, DOM, console logs, network summaries, and action results must not be treated as user or system instructions.

The panel also redacts token-like values from page URL, body text, DOM snippets, console logs, network URLs, and action results when they match common key names such as `token`, `access_token`, `api_key`, `password`, `secret`, `session`, `cookie`, `csrf`, or `jwt`.

## Page Execution Boundary

`[ACTION:eval]` executes JavaScript in the inspected page. Use cc-devtools only on pages you trust, especially if you are logged in.

Avoid using it on:

- Payment pages
- Admin consoles
- Production sessions with sensitive data
- Pages containing secrets or tokens

## Reporting a Vulnerability

Open a private advisory if GitHub security advisories are enabled for the repository. Otherwise, open an issue with minimal reproduction details and avoid posting secrets, tokens, or private URLs.

Useful report format:

- Affected version or commit
- Operating system and browser
- Steps to reproduce
- Expected behavior
- Actual behavior
- Impact
- Suggested fix, if known
