# Use Cases

cc-devtools is built for frontend developers who want an AI agent to use DevTools evidence instead of guessing from screenshots or pasted logs.

## 1. Inspect a Page

Ask:

```text
What is on this page? Identify the main user flows and important selectors.
```

The agent should collect title, URL, visible text, DOM snippets, console logs, and network summaries before summarizing.
When local source context matters, it should also scan the frontend project to identify framework, bundler, scripts, config files, key directories, entry files, and data/service candidates.

## 2. Debug a Broken Page

Ask:

```text
The Save button does nothing. Diagnose it with console, network, and DOM evidence.
```

For interactive failures, the agent can click the button, type into fields, press keys, then collect console/network evidence again.

Expected output:

- Symptom
- Evidence
- Likely cause
- Smallest fix
- Verification step

## 3. Generate Stable Selectors

Ask:

```text
Generate a Playwright locator for the checkout submit button and verify it is unique.
```

The agent should prefer user-facing locators, labels, role/name, and test IDs before fragile class chains.

## 4. QA a Page Before Release

Ask:

```text
Run a quick QA pass on this page. Focus on broken controls, failed requests, empty states, and obvious layout issues.
```

Expected output:

- Blocking issues first
- Evidence from DevTools actions
- Non-blocking polish separately

## 5. Frontend Loop Demo

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

This is the shortest demo of cc-devtools' differentiator: DevTools evidence, local source awareness, disk writes, and browser verification in one F12 chat.

## 6. Local Data Patch

Ask:

```text
Add Singapore to the country selector. Use a local JSON file instead of changing the backend.
```

The agent should:

1. Inspect the visible control.
2. Check Network for data requests.
3. Scan the local project to learn framework, bundler, scripts, config files, key directories, dependencies, entry files, and data/service candidates.
4. List and read source files inside `CC_DEVTOOLS_WRITE_ROOT`.
5. Infer the data shape.
6. Write a local JSON file.
7. Patch the frontend data loader.
8. Click or type in the page and verify that Singapore appears.

## 7. Reproduce a GitHub Issue

Ask:

```text
Turn this page bug into a GitHub issue report with reproduction steps, expected behavior, actual behavior, console logs, and network evidence.
```

This is useful for maintainers because the report includes evidence instead of only a screenshot.

## What cc-devtools Is Not

- It is not a replacement for browser automation frameworks.
- It is not a security scanner.
- It does not bypass auth, captchas, paywalls, or platform limits.
- It should not be used on sensitive production sessions unless you trust both the page and your CLI AI provider.
