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
