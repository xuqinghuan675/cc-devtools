import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const installedWorkflowRoot = join(here, 'cc_devtools', 'skills', 'frontend-devtools-workflows');
const repoWorkflowRoot = join(here, '..', 'cc_devtools', 'skills', 'frontend-devtools-workflows');
const workflowFiles = {
  inspect: 'SKILL.md',
  debug: 'references/debugging.md',
  selector: 'references/selectors.md',
  qa: 'references/qa.md',
  'local-data-patch': 'references/local-data-patch.md'
};

export function getWorkflowPrompt(name) {
  const key = Object.prototype.hasOwnProperty.call(workflowFiles, name) ? name : 'inspect';
  try {
    return readFileSync(join(installedWorkflowRoot, workflowFiles[key]), 'utf8');
  } catch {
    return readFileSync(join(repoWorkflowRoot, workflowFiles[key]), 'utf8');
  }
}
