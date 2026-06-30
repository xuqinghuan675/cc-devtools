# QA Workflow

Use when reviewing a frontend page before release or checking obvious UI regressions.

## Checklist

1. Page loads without console errors that affect users.
2. Key requests succeed or failures are explained.
3. Primary controls are present and enabled.
4. Forms have labels, placeholders, validation, and submit behavior.
5. Empty, loading, and error states are visible or accounted for.
6. Layout is not obviously broken in the current viewport.
7. Links and buttons have meaningful visible text.

## Output

- Pass/fail summary
- Evidence from console, network, and DOM
- Blocking issues first
- Non-blocking polish separately

Do not invent results for screen sizes, performance, or accessibility tree data that you did not inspect.
