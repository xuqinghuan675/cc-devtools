# Debug Workflow

Use when the page is broken, data does not load, buttons do nothing, layout breaks, or a user asks why something failed.

## Procedure

1. Capture current URL and title.
2. Run `[ACTION:console][/ACTION]` and classify errors: JavaScript exception, missing asset, CORS, sourcemap noise, framework warning.
3. Run `[ACTION:network][/ACTION]` and identify failed or suspicious requests: 4xx, 5xx, redirects, zero-byte responses, slow APIs.
4. Inspect the affected DOM with `[ACTION:dom]` or `[ACTION:text]`.
5. If the issue may come from local code, use `[ACTION:file:list]pattern[/ACTION]` and `[ACTION:file:read]path[/ACTION]` before proposing `[ACTION:save]`.

## Output

- Symptom
- Evidence with selectors, console lines, and request summaries
- Most likely cause
- Smallest next fix
- Verification step after the fix

Never describe a fix as applied unless you used the file actions and verified the page state.
