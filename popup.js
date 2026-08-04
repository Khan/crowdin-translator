const WORLD_LANGUAGES = {
  'af':'Afrikaans','sq':'Albanian','am':'Amharic','ar':'Arabic',
  'hy':'Armenian','as':'Assamese','az':'Azerbaijani','eu':'Basque',
  'be':'Belarusian','bn':'Bengali','bs':'Bosnian','bg':'Bulgarian',
  'ca':'Catalan','zh-CN':'Chinese (Simplified)','zh-TW':'Chinese (Traditional)',
  'hr':'Croatian','cs':'Czech','da':'Danish','nl':'Dutch',
  'eo':'Esperanto','et':'Estonian','fi':'Finnish','fr':'French',
  'gl':'Galician','ka':'Georgian','de':'German','el':'Greek',
  'gu':'Gujarati','ht':'Haitian Creole','ha':'Hausa','he':'Hebrew',
  'hi':'Hindi','hu':'Hungarian','is':'Icelandic','ig':'Igbo',
  'id':'Indonesian','ga':'Irish','it':'Italian','ja':'Japanese',
  'jv':'Javanese','kn':'Kannada','kk':'Kazakh','km':'Khmer',
  'ko':'Korean','ku':'Kurdish','ky':'Kyrgyz','lo':'Lao',
  'lv':'Latvian','lt':'Lithuanian','mk':'Macedonian','ms':'Malay',
  'ml':'Malayalam','mt':'Maltese','mr':'Marathi','mn':'Mongolian',
  'my':'Myanmar (Burmese)','ne':'Nepali','no':'Norwegian','or':'Odia',
  'ps':'Pashto','fa':'Persian','pl':'Polish','pt':'Portuguese',
  'pa':'Punjabi','ro':'Romanian','ru':'Russian','sr':'Serbian',
  'si':'Sinhala','sk':'Slovak','sl':'Slovenian','so':'Somali',
  'es':'Spanish','sw':'Swahili','sv':'Swedish','tg':'Tajik',
  'ta':'Tamil','te':'Telugu','th':'Thai','tr':'Turkish',
  'uk':'Ukrainian','ur':'Urdu','uz':'Uzbek','vi':'Vietnamese',
  'cy':'Welsh','xh':'Xhosa','yi':'Yiddish','yo':'Yoruba','zu':'Zulu',
};

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'Free tier available (rate-limited). Paid tier recommended for teams.',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'Requires a funded OpenAI platform account.',
  },
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-haiku-4-5-20251001',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'Requires an Anthropic Console account with credits.',
  },
};

const languageSelect    = document.getElementById('language');
const providerSelect    = document.getElementById('aiProvider');
const providerHint      = document.getElementById('providerHint');
const apiKeyInput       = document.getElementById('apiKey');
const aiModelInput      = document.getElementById('aiModel');
const glossaryInput     = document.getElementById('glossaryUrl');
const glossaryMathInput = document.getElementById('glossaryUrlMath');
const glossarySciInput  = document.getElementById('glossaryUrlScience');
const saveBtn           = document.getElementById('saveBtn');
const testBtn           = document.getElementById('testBtn');
const statusMsg         = document.getElementById('statusMsg');

// In-memory copy of per-provider keys; the visible key field always shows
// the key for the currently selected provider.
let apiKeys = { gemini: '', openai: '', anthropic: '' };

// Populate language selector sorted alphabetically by language name
const sorted = Object.entries(WORLD_LANGUAGES).sort((a, b) => a[1].localeCompare(b[1]));
for (const [code, name] of sorted) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = name;
  languageSelect.appendChild(opt);
}
languageSelect.value = 'hi'; // default

function refreshProviderUI() {
  const p = PROVIDERS[providerSelect.value];
  providerHint.innerHTML =
    `Get a key: <a href="${p.keyUrl}" target="_blank">${p.keyUrl.replace('https://','')}</a><br>${p.keyHint}`;
  apiKeyInput.value = apiKeys[providerSelect.value] || '';
  aiModelInput.placeholder = `blank = ${p.defaultModel}`;
}

providerSelect.addEventListener('change', refreshProviderUI);
apiKeyInput.addEventListener('input', () => {
  apiKeys[providerSelect.value] = apiKeyInput.value.trim();
});

// Load saved settings
chrome.storage.sync.get(
  ['targetLanguage', 'aiProvider', 'apiKeys', 'aiModel', 'geminiApiKey',
   'glossaryUrl', 'glossaryUrlMath', 'glossaryUrlScience'],
  (r) => {
    if (r.targetLanguage) languageSelect.value = r.targetLanguage;
    if (r.apiKeys && typeof r.apiKeys === 'object') apiKeys = { ...apiKeys, ...r.apiKeys };
    // Legacy migration: single Gemini key saved before providers existed
    if (r.geminiApiKey && !apiKeys.gemini) apiKeys.gemini = r.geminiApiKey;
    if (r.aiProvider && PROVIDERS[r.aiProvider]) providerSelect.value = r.aiProvider;
    if (r.aiModel)            aiModelInput.value      = r.aiModel;
    if (r.glossaryUrl)        glossaryInput.value     = r.glossaryUrl;
    if (r.glossaryUrlMath)    glossaryMathInput.value = r.glossaryUrlMath;
    if (r.glossaryUrlScience) glossarySciInput.value  = r.glossaryUrlScience;
    refreshProviderUI();
  }
);

function showStatus(msg, type, persist) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status ' + type;
  if (!persist) setTimeout(() => { statusMsg.className = 'status'; }, 5000);
}

saveBtn.addEventListener('click', () => {
  apiKeys[providerSelect.value] = apiKeyInput.value.trim();
  const settings = {
    targetLanguage:     languageSelect.value,
    aiProvider:         providerSelect.value,
    apiKeys,
    aiModel:            aiModelInput.value.trim(),
    glossaryUrl:        glossaryInput.value.trim(),
    glossaryUrlMath:    glossaryMathInput.value.trim(),
    glossaryUrlScience: glossarySciInput.value.trim(),
  };
  chrome.storage.sync.set(settings, () => {
    showStatus('✅ Settings saved!', 'success');
  });
});

// ── Per-provider live test ────────────────────────────────────────────────────
const TEST_TEXT = 'Hello! This is a test. The answer is $x^2 + 1$.';

async function testGemini(key, model, sysPrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ parts: [{ text: TEST_TEXT }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

async function testOpenAI(key, model, sysPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: TEST_TEXT },
      ],
      temperature: 0.1, max_tokens: 128,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function testAnthropic(key, model, sysPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: 128, temperature: 0.1,
      system: sysPrompt,
      messages: [{ role: 'user', content: TEST_TEXT }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim();
}

testBtn.addEventListener('click', async () => {
  const provider = providerSelect.value;
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus(`Enter your ${PROVIDERS[provider].label} API key first.`, 'error');
    return;
  }
  const lang     = languageSelect.value;
  const langName = WORLD_LANGUAGES[lang] || lang;
  const model    = aiModelInput.value.trim() || PROVIDERS[provider].defaultModel;
  const sysPrompt = `Translate to ${langName}. Keep $math$ unchanged. Return only the translated text.`;

  testBtn.disabled = true;
  testBtn.textContent = '⏳…';
  showStatus(`Testing ${PROVIDERS[provider].label} (${model}) with ${langName}…`, 'info', true);

  try {
    let result;
    if (provider === 'openai')         result = await testOpenAI(key, model, sysPrompt);
    else if (provider === 'anthropic') result = await testAnthropic(key, model, sysPrompt);
    else                               result = await testGemini(key, model, sysPrompt);
    showStatus(`✅ Working! "${result || '(empty response)'}"`, 'success', true);
  } catch (e) {
    showStatus(`❌ ${e.message}`, 'error', true);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '🧪 Test';
  }
});
