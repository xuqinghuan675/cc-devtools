# Selector Workflow

Use when creating or debugging CSS selectors, Playwright locators, Selenium locators, or automation tests.

## Locator Priority

1. User-facing role and name: `getByRole('button', { name: 'Save' })`
2. Label, placeholder, alt text, or visible text
3. Explicit test contract: `data-testid`, `data-test`, `data-cy`
4. Stable IDs or semantic attributes
5. CSS structure only as a fallback

## Procedure

1. Inspect target element with `[ACTION:dom]selector[/ACTION]`.
2. Check uniqueness with `[ACTION:eval]document.querySelectorAll("...").length[/ACTION]`.
3. Prefer accessible selectors over class chains.
4. Return both a Playwright locator and a CSS fallback when useful.

## Output

- Recommended locator
- Why it is stable
- Fallback selector
- Validation command or DOM count
