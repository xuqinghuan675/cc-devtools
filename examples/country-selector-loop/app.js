const DATA_URL = 'public/cc-devtools/countries.json';

const countrySelect = document.querySelector('#country-select');
const reloadButton = document.querySelector('#reload-data');
const verifyButton = document.querySelector('#verify-country');
const output = document.querySelector('#verification-output');
const countLabel = document.querySelector('#country-count');
const promptField = document.querySelector('#demo-prompt');
const copyButton = document.querySelector('#copy-demo-prompt');
const promptCopyStatus = document.querySelector('#prompt-copy-status');

const fallbackCountries = [
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'DE', name: 'Germany' }
];

function normalizeCountries(value) {
  if (!Array.isArray(value)) return fallbackCountries;
  return value
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      code: typeof item.code === 'string' && item.code.trim() ? item.code.trim() : item.name.trim().slice(0, 2).toUpperCase(),
      name: item.name.trim()
    }));
}

function renderCountries(countries) {
  countrySelect.innerHTML = '';
  for (const country of countries) {
    const option = document.createElement('option');
    option.value = country.name;
    option.dataset.code = country.code;
    option.textContent = `${country.name} (${country.code})`;
    countrySelect.appendChild(option);
  }
  countLabel.textContent = `${countries.length} option${countries.length === 1 ? '' : 's'}`;
  window.__COUNTRY_LOOP_DEMO__ = { countries, loadedAt: new Date().toISOString() };
}

async function loadCountries() {
  output.value = 'Loading local country data...';
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const countries = normalizeCountries(await response.json());
    renderCountries(countries);
    output.value = `Loaded ${countries.length} countries from ${DATA_URL}.`;
  } catch (error) {
    renderCountries(fallbackCountries);
    output.value = `Using fallback countries because ${DATA_URL} failed: ${error.message}`;
  }
}

function verifySelection() {
  const selected = countrySelect.selectedOptions[0];
  if (!selected) {
    output.value = 'No country is selected.';
    return;
  }
  const name = selected.value;
  const code = selected.dataset.code || 'unknown';
  output.value = name === 'Singapore'
    ? `Verified: Singapore (${code}) is selectable from local data.`
    : `Selected ${name} (${code}). Singapore is not selected yet.`;
}

async function copyDemoPrompt() {
  const prompt = promptField.value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(prompt);
    } else {
      promptField.select();
      document.execCommand('copy');
    }
    promptCopyStatus.value = 'Prompt copied. Paste it in the F12 Claude Code panel.';
  } catch {
    promptCopyStatus.value = 'Select the prompt text and copy it manually.';
  }
}

reloadButton.addEventListener('click', loadCountries);
verifyButton.addEventListener('click', verifySelection);
countrySelect.addEventListener('change', verifySelection);
copyButton.addEventListener('click', copyDemoPrompt);

loadCountries();
