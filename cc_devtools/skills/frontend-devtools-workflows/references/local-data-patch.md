# Local Data Patch Workflow

Use when the user wants to change frontend behavior by writing local files, mocking data, or making the frontend read a local JSON file. Example: adding a new country option to a country selector.

## Safety Contract

1. Use only paths inside the allowed write root.
2. Read existing files before editing them; in short, read existing files before editing.
3. Explain the target files before using `[ACTION:save]`.
4. Keep data patches local and reversible.
5. Do not alter auth, payment, admin permissions, or production-only safety checks.

## Procedure

1. Inspect the visible UI and identify the affected control.
2. Use `[ACTION:network][/ACTION]` to find likely data requests such as `/countries`, `countries.json`, or GraphQL options.
3. Use `[ACTION:file:list]package.json[/ACTION]`, `[ACTION:file:list]*Country*[/ACTION]`, `[ACTION:file:list]*countr*[/ACTION]`, or framework-specific patterns to locate source files.
4. Use `[ACTION:file:read]path[/ACTION]` before any edit.
5. Infer the data schema: for countries, common shapes are `{ "code": "SG", "name": "Singapore" }` or `{ "value": "SG", "label": "Singapore" }`.
6. Write or update a local JSON file such as `public/cc-devtools/countries.json`.
7. Modify the frontend to read that local file in development, or point the existing data loader at it when that is the user's explicit goal.
8. Refresh or re-run the page and verify the option exists with DOM/text actions.

## Country Option Example

For "add Singapore to country options":

1. Find the selector:
   `[ACTION:dom]select[name*="country"], [role="combobox"][/ACTION]`
2. Find files:
   `[ACTION:file:list]*countr*[/ACTION]`
3. Read candidate:
   `[ACTION:file:read]src/data/countries.json[/ACTION]`
4. Save local data:
   `[ACTION:save]public/cc-devtools/countries.json
[{"code":"US","name":"United States"},{"code":"SG","name":"Singapore"}]
[/ACTION]`
5. Verify:
   `[ACTION:text]select[name*="country"][/ACTION]`

## Output

- Data source found
- Schema used
- Files read and written
- Verification evidence
- Rollback instructions
