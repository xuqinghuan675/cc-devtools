import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../extension/panel/panel-core.js');

test('Recipe model normalizes schema, tags, evidence types, and redacted text', () => {
  const recipe = core.createRecipe({
    id: 'recipe_login',
    name: 'Login smoke',
    description: 'Checks login',
    tags: 'auth, smoke, auth',
    workflow: 'qa',
    promptTemplate: 'Use token=abc123',
    evidenceTypes: ['console', 'network', 'unknown'],
    actionPlan: 'Open /login\nFill form\nAssert dashboard',
  });

  assert.equal(recipe.schemaVersion, 1);
  assert.equal(recipe.id, 'recipe_login');
  assert.deepEqual(recipe.tags, ['auth', 'smoke']);
  assert.deepEqual(recipe.evidenceTypes, ['console', 'network']);
  assert.deepEqual(recipe.actionPlan, ['Open /login', 'Fill form', 'Assert dashboard']);
  assert.doesNotMatch(recipe.promptTemplate, /abc123/);

  assert.equal(core.validateRecipe(recipe).valid, true);
  assert.equal(core.validateRecipe({ schemaVersion: 1, name: '' }).valid, false);
});

test('Recipe import/export validates JSON, schemaVersion, count, and byte budget', () => {
  const recipe = core.createRecipe({ name: 'Selectors', promptTemplate: 'Collect DOM' });
  const exported = core.exportRecipes([recipe]);
  const imported = core.importRecipes(exported);

  assert.equal(imported.valid, true);
  assert.equal(imported.recipes.length, 1);
  assert.equal(imported.recipes[0].schemaVersion, 1);

  const invalidJson = core.importRecipes('{nope');
  assert.equal(invalidJson.valid, false);
  assert.match(invalidJson.errors.join('\n'), /Invalid JSON/);

  const wrongVersion = core.importRecipes(JSON.stringify({ schemaVersion: 999, recipes: [recipe] }));
  assert.equal(wrongVersion.valid, false);
  assert.match(wrongVersion.errors.join('\n'), /schemaVersion/);

  const tooMany = core.importRecipes(JSON.stringify({ schemaVersion: 1, recipes: [recipe, recipe] }), { maxItems: 1 });
  assert.equal(tooMany.valid, false);
  assert.match(tooMany.errors.join('\n'), /Too many recipes/);
});

test('Project memory keeps buckets isolated and validates import payloads', () => {
  const memory = core.createProjectMemory({
    ignoredConsolePatterns: ['ResizeObserver loop limit exceeded'],
    knownSelectors: ['button[data-testid="save"]'],
    commonFlows: ['Login -> Dashboard'],
    apiContracts: ['GET /api/users'],
    qaChecklists: ['No console errors'],
    unknownBucket: ['drop me'],
  });

  assert.equal(memory.schemaVersion, 1);
  assert.deepEqual(memory.knownSelectors, ['button[data-testid="save"]']);
  assert.equal(Object.hasOwn(memory, 'unknownBucket'), false);
  assert.equal(core.validateProjectMemory(memory).valid, true);

  const exported = core.exportProjectMemory(memory);
  const imported = core.importProjectMemory(exported);
  assert.equal(imported.valid, true);
  assert.deepEqual(imported.memory.apiContracts, ['GET /api/users']);

  const invalid = core.importProjectMemory(JSON.stringify({ schemaVersion: 999, knownSelectors: [] }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /schemaVersion/);
});
