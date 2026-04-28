// engine.js - UI helpers, config, generation, codex, batch, diff, presets

function toggleSection(header) {
  const chevron = header.querySelector('.section-chevron');
  const body = header.nextElementSibling;
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.classList.toggle('open', !isOpen);
  saveSectionStates();
};

function toggleShortcutsModal() {
  document.getElementById('shortcutsModal').classList.add('open');
}

function closeShortcutsModal() {
  document.getElementById('shortcutsModal').classList.remove('open');
}


function setPresetUrl(url, format) {
  document.getElementById('providerUrl').value = url;
  document.getElementById('apiFormat').value = format;
  saveConfig();
  updateApiStatus();
  updateActiveBadge();
}

function formatCtx(v) {
  if (v >= 1000000) return (v/1000000).toFixed(v%1000000===0?0:1) + 'M';
  if (v >= 1000) return Math.round(v/1024) + 'k';
  return v;
}

function updateMultimodalWarn() {
  const model = document.getElementById('modelSelect').value.trim();
  const warn = document.getElementById('multimodalWarn');
  const confirm = document.getElementById('multimodalConfirm');
  if (model.length > 0) {
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
    confirm.classList.remove('on');
    state.multimodalConfirmed = false;
  }
  updateGenBtnHint();
}

function updateJLLMModeUI() {
    const maxTokGroup = document.getElementById('maxTokGroup');
    if (state.jllmMode) {
        maxTokGroup.style.opacity = '0.4';
        maxTokGroup.style.pointerEvents = 'none';
    } else {
        maxTokGroup.style.opacity = '1';
        maxTokGroup.style.pointerEvents = 'auto';
    }
}

function loadConfig() {
  const saved = localStorage.getItem('ccos_config');
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      Object.assign(state, cfg);
    } catch(e) {}
  }
  applyStateToUI();
}

function applyStateToUI() {
  const g = id => document.getElementById(id);
  if (g('providerUrl')) g('providerUrl').value = state.providerUrl || '';
  if (g('apiFormat')) g('apiFormat').value = state.apiFormat || 'openai';
  if (g('modelSelect')) g('modelSelect').value = state.model || '';
  if (g('apiKey')) g('apiKey').value = state.apiKey || '';
  if (g('temp')) { g('temp').value = state.temp; if(g('tempVal')) g('tempVal').textContent = parseFloat(state.temp).toFixed(2); }
  if (g('maxTok')) { g('maxTok').value = state.maxTokens; if(g('maxTokVal')) g('maxTokVal').textContent = state.maxTokens; }
  if (g('topP')) { g('topP').value = state.topP; if(g('topPVal')) g('topPVal').textContent = parseFloat(state.topP).toFixed(2); }
  if (g('contextWindow')) { g('contextWindow').value = state.contextWindow || 32768; if(g('contextWindowVal')) g('contextWindowVal').textContent = formatCtx(state.contextWindow || 32768); }
  if (g('multimodalConfirm')) g('multimodalConfirm').classList.toggle('on', !!state.multimodalConfirmed);
  updateMultimodalWarn();
  if (g('streamToggle')) g('streamToggle').classList.toggle('on', state.streaming);
  if (g('thinkToggle')) g('thinkToggle').classList.toggle('on', state.thinking);
  if (g('jllmToggle')) g('jllmToggle').classList.toggle('on', !!state.jllmMode);
  updateJLLMModeUI();
  document.querySelectorAll('.scenario-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scenario === state.scenario);
  });
  if (g('frictionSelect')) g('frictionSelect').value = state.friction || '';
  if (g('loopSelect')) g('loopSelect').value = state.loop || '';
  if (g('visibilitySelect')) g('visibilitySelect').value = state.visibility || '';
  updateApiStatus();
  updateActiveBadge();
}

function saveConfig() {
  const g = id => document.getElementById(id);
  if (g('providerUrl')) state.providerUrl = g('providerUrl').value.trim();
  if (g('apiFormat')) state.apiFormat = g('apiFormat').value;
  if (g('modelSelect')) state.model = g('modelSelect').value;
  if (g('apiKey')) state.apiKey = g('apiKey').value;
  if (g('temp')) state.temp = parseFloat(g('temp').value);
  if (g('maxTok')) state.maxTokens = parseInt(g('maxTok').value);
  if (g('topP')) state.topP = parseFloat(g('topP').value);
  if (g('contextWindow')) state.contextWindow = parseInt(g('contextWindow').value);
  if (g('multimodalConfirm')) state.multimodalConfirmed = g('multimodalConfirm').classList.contains('on');
  if (g('streamToggle')) state.streaming = g('streamToggle').classList.contains('on');
  if (g('thinkToggle')) state.thinking = g('thinkToggle').classList.contains('on');
  if (g('jllmToggle')) state.jllmMode = g('jllmToggle').classList.contains('on');
  if (g('frictionSelect')) state.friction = g('frictionSelect').value;
  if (g('loopSelect')) state.loop = g('loopSelect').value;
  if (g('visibilitySelect')) state.visibility = g('visibilitySelect').value;
  localStorage.setItem('ccos_config', JSON.stringify(state));
  updateApiStatus();
  updateActiveBadge();
  updateGenBtnHint();
  checkOnboarding();
}

function setScenario(s, el) {
  state.scenario = s;
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  saveConfig();
}

function updateApiStatus() {
  const keyEl = document.getElementById('apiKey');
  const urlEl = document.getElementById('providerUrl');
  const key = keyEl ? keyEl.value.trim() : '';
  const url = urlEl ? urlEl.value.trim() : '';
  const dot = document.getElementById('apiDot');
  const label = document.getElementById('apiLabel');
  if (dot && label) {
    if (key.length > 8 && url.length > 0) {
      dot.classList.add('active');
      const shortUrl = url.replace(/^https?:\/\//, '').split('/')[0];
      label.textContent = shortUrl + ' · ' + key.substring(0,6) + '…';
    } else {
      dot.classList.remove('active');
      label.textContent = key.length > 8 ? 'no base url' : 'no api key';
    }
  }
  if (typeof checkGuideApiKey === 'function') checkGuideApiKey();
}

function updateActiveBadge() {
  const badge = document.getElementById('activeBadge');
  badge.textContent = (state.apiFormat || 'openai') + ' / ' + (state.model || 'no model');
}

function toggleKeyVis() {
  const inp = document.getElementById('apiKey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function buildSystemPrompt() {
  let sys = SYSTEM_PROMPT_RAW;
  const overrides =[];
  if (state.friction) overrides.push(`Use friction pattern: ${state.friction}`);
  if (state.loop) overrides.push(`Use feedback loop: ${state.loop}`);
  if (state.visibility) overrides.push(`Friction visibility: ${state.visibility}`);
  if (state.scenario && state.scenario !== 'none') overrides.push(`Select SCENARIO ${state.scenario}`);
  if (overrides.length) {
    sys = `[GENERATION DIRECTIVES]\n${overrides.join('\n')}\n\n---\n\n` + sys;
  }
  return sys;
}

function buildUserMessage() {
  const context = document.getElementById('contextInput').value.trim();
  const override = document.getElementById('overrideInput').value.trim();

  const imageCount = imageDataArray.length;
  let msg = imageCount > 1 
    ? `Generate a character card from the ${imageCount} provided reference images. These images all depict the same character from different angles, poses, or expressions. Synthesize the visual information across all images to create a cohesive character description.`
    : 'Generate a character card from the provided image.';
  
  if (override) {
    msg = `[MANUAL OVERRIDE]\n${override}\n[/MANUAL OVERRIDE]\n\n` + msg;
  }
  if (context) msg += `\n\n[ADDITIONAL CONTEXT]\n${context}`;
  return msg;
}

function setStatus(type, text) {
  const dot = document.getElementById('statusDot');
  const label = document.getElementById('statusText');
  dot.className = 'status-dot' + (type ? ' ' + type : '');
  label.textContent = text;
}

function setOutput(text, empty = false) {
  const area = document.getElementById('outputArea');
  if (empty) {
    area.textContent = text;
    area.classList.add('empty');
  } else {
    area.textContent = text;
    area.classList.remove('empty');
    area.scrollTop = area.scrollHeight;
  }
}

function toggleEditMode(forceExit = false) {
  const outDiv = document.getElementById('outputArea');
  const editArea = document.getElementById('editArea');
  const btn = document.getElementById('btnEdit');

  if (isEditing || forceExit) {
    if (isEditing) {
      isEditing = false;
      outputBuffer = editArea.value;
      if (currentVersionIndex >= 0) {
        sessionGenerations[currentVersionIndex] = outputBuffer;
      }
    }
    
    btn.textContent = 'Edit';
    btn.classList.remove('active-edit');
    outDiv.style.display = '';
    editArea.style.display = 'none';
    
    if (!forceExit) {
      setOutput(outputBuffer, !outputBuffer);
      document.getElementById('outputMeta').textContent = (sessionGenerations.length > 1 ? `Version ${currentVersionIndex + 1} · ` : '') + 'Edited · ' + outputBuffer.length + ' chars';
      toast('Edits saved to current card');
    }
  } else {
    if (!outputBuffer) { 
      toast('Nothing to edit yet'); 
      return; 
    }
    isEditing = true;
    btn.textContent = 'Done';
    btn.classList.add('active-edit');
    
    editArea.value = outputBuffer;
    outDiv.style.display = 'none';
    editArea.style.display = 'block';
    editArea.focus();
  }
}

function updateVersionUI() {
  // We use the overridden updateVersionUI (defined later in the code) to handle renderVersionTabs,
  // but if it's missing, this empty block acts as a safe fallback instead of crashing on the removed versionControl div.
}

function prevVersion() {
  if (currentVersionIndex > 0) {
    currentVersionIndex--;
    loadVersion(currentVersionIndex);
  }
}

function nextVersion() {
  if (currentVersionIndex < sessionGenerations.length - 1) {
    currentVersionIndex++;
    loadVersion(currentVersionIndex);
  }
}

function loadVersion(index) {
  if (isEditing) toggleEditMode(true);
  outputBuffer = sessionGenerations[index];
  setOutput(outputBuffer);
  updateVersionUI();
  document.getElementById('outputMeta').textContent = 'Version ' + (index + 1) + ' · ' + outputBuffer.length + ' chars';
}

async function generate() {
  if (isEditing) toggleEditMode(true);
  
  const key = document.getElementById('apiKey').value.trim();
  const providerUrl = document.getElementById('providerUrl').value.trim();

  if (!providerUrl) { toast('Enter an API Base URL first', 'error'); return; }
  if (!key) { toast('Enter an API key first', 'error'); return; }
  if (imageDataArray.length === 0) { toast('Drop at least one image first', 'error'); return; }
  const model = document.getElementById('modelSelect').value.trim();
  if (model && !state.multimodalConfirmed) {
    toast('Confirm your model supports vision (image input) before generating', 'error');
    document.getElementById('multimodalWarn').style.display = 'block';
    document.getElementById('multimodalWarn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const currentImageSetHash = imageDataArray.map(img => img.name).sort().join(',');
  if (lastGenImageName !== currentImageSetHash) {
    sessionGenerations = [];
    lastGenImageName = currentImageSetHash;
  }

  outputBuffer = '';
  genStartTime = Date.now();
  document.getElementById('outputBadge').style.display = 'none';
  document.getElementById('tokenCount').textContent = '';
  document.getElementById('outputMeta').textContent = '';

  resetQualityGates();
  clearModelCardReport();
  setGenerationStep(0);

  const genBtn = document.getElementById('genBtn');
  const stopBtn = document.getElementById('stopBtn');
  genBtn.disabled = true;
  genBtn.classList.add('loading');
  document.getElementById('genBtnText').textContent = 'Generating…';
  stopBtn.classList.add('visible');
  setStatus('running', 'generating…');
  setOutput('', true);

  abortController = new AbortController();

  setGenerationStep(3);

  const maxTokensForCall = state.jllmMode ? 2000 : state.maxTokens;

  try {
    if (state.apiFormat === 'gemini') {
      await generateGemini(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTokensForCall);
    } else if (state.apiFormat === 'claude') {
      await generateClaude(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTokensForCall);
    } else {
      await generateOpenAI(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTokensForCall);
    }
  } catch(e) {
    if (e.name === 'AbortError') {
      setStatus('', 'stopped');
    } else {
      setStatus('error', 'error: ' + e.message);
      toast('Error: ' + e.message);
    }
  }

  if (outputBuffer.trim().length > 0) {
    sessionGenerations.push(outputBuffer);
    currentVersionIndex = sessionGenerations.length - 1;
    clearDraft(); 
  }
  updateVersionUI();

  genBtn.disabled = false;
  genBtn.classList.remove('loading');
  document.getElementById('genBtnText').textContent = 'Generate Card';
  stopBtn.classList.remove('visible');

  if (outputBuffer) {
    setGenerationStep(4);
    checkQualityGates(outputBuffer);
    setGenerationStep(5);
    const elapsed = ((Date.now() - genStartTime) / 1000).toFixed(1);
    document.getElementById('outputBadge').style.display = '';
    document.getElementById('outputMeta').textContent = (sessionGenerations.length > 1 ? `Version ${currentVersionIndex + 1} · ` : '') + elapsed + 's · ' + outputBuffer.length + ' chars';
    setStatus('done', 'done in ' + elapsed + 's');
    
    // Run model card quality validation
    const modelCardReport = validateAgainstModelCard(outputBuffer);
    if (modelCardReport) {
      displayModelCardReport(modelCardReport);
    }
  }

  setTimeout(() => setGenerationStep(-1), 2000);
}

async function generateGemini(key, baseUrl, systemPrompt, userMessage, maxTokensForCall) {
  const base = baseUrl.replace(/\/$/, '');
  const model = state.model;
  const url = `${base}/models/${model}:${state.streaming ? 'streamGenerateContent' : 'generateContent'}?key=${key}&alt=sse`;

  const parts = [];
  imageDataArray.forEach(img => {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  });
  parts.push({ text: userMessage });

  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts:[{ text: systemPrompt }] },
    generationConfig: {
      temperature: state.temp,
      maxOutputTokens: maxTokensForCall,
      topP: state.topP,
    }
  };

  if (state.thinking && (model.includes('2.5') || model.includes('flash-2'))) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 8000 };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortController.signal
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const part = json.candidates?.[0]?.content?.parts?.[0];
        if (part?.text) {
          outputBuffer += part.text;
          setOutput(outputBuffer);
          const usage = json.usageMetadata;
          if (usage) {
            document.getElementById('tokenCount').textContent = (usage.promptTokenCount || 0) + ' in / ' + (usage.candidatesTokenCount || 0) + ' out';
          }
        }
      } catch(e) {}
    }
  }
}

async function generateClaude(key, baseUrl, systemPrompt, userMessage, maxTokensForCall) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';
  const body = {
    model: state.model,
    max_tokens: maxTokensForCall,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: imageDataArray.length > 0
        ? [
            ...imageDataArray.map(img => ({ 
              type: 'image', 
              source: { type: 'base64', media_type: img.mimeType, data: img.base64 } 
            })),
            { type: 'text', text: userMessage }
          ]
        : userMessage
    }],
    stream: true,
    temperature: state.temp,
    top_p: state.topP,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body),
    signal: abortController.signal
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta' && json.delta?.text) {
          outputBuffer += json.delta.text;
          setOutput(outputBuffer);
        }
        if (json.type === 'message_delta' && json.usage) {
          document.getElementById('tokenCount').textContent = (json.usage.input_tokens || 0) + ' in / ' + (json.usage.output_tokens || 0) + ' out';
        }
      } catch(e) {}
    }
  }
}

async function generateOpenAI(key, baseUrl, systemPrompt, userMessage, maxTokensForCall) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  const body = {
    model: state.model,
    max_tokens: maxTokensForCall,
    messages:[
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: imageDataArray.length > 0
          ? [
              ...imageDataArray.map(img => ({ 
                type: 'image_url', 
                image_url: { url: `data:${img.mimeType};base64,${img.base64}` } 
              })),
              { type: 'text', text: userMessage }
            ]
          : userMessage
      }
    ],
    stream: true,
    temperature: state.temp,
    top_p: state.topP,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify(body),
    signal: abortController.signal
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          outputBuffer += delta;
          setOutput(outputBuffer);
        }
        if (json.usage) {
          document.getElementById('tokenCount').textContent = (json.usage.prompt_tokens || 0) + ' in / ' + (json.usage.completion_tokens || 0) + ' out';
        }
      } catch(e) {}
    }
  }
}

function nukeData() {
  if (isEditing) toggleEditMode(true);
  
  if (!confirm('Delete all saved config and history? This cannot be undone.')) return;
  localStorage.removeItem('ccos_config');
  localStorage.removeItem('ccos_history');
  
  state = {
    providerUrl: '', apiFormat: 'openai', model: '', apiKey: '',
    temp: 1.0, maxTokens: 4096, topP: 0.95, contextWindow: 32768,
    multimodalConfirmed: false, streaming: true, thinking: true, jllmMode: false,
    scenario: 'none', friction: '', loop: '', visibility: '',
  };
  
  sessionGenerations = [];
  currentVersionIndex = -1;
  lastGenImageName = null;
  updateVersionUI();

  clearAllImages();

  applyStateToUI();
  toast('All data nuked, a fresh start T-T)');
}

async function testConnection() {
  const key = document.getElementById('apiKey').value.trim();
  const providerUrl = document.getElementById('providerUrl').value.trim();
  const model = document.getElementById('modelSelect').value.trim();

  if (!providerUrl) { toast('Enter an API Base URL first'); return; }
  if (!key) { toast('Enter an API key first'); return; }
  if (!model) { toast('Enter a model name first'); return; }

  const btn = document.getElementById('testBtn');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  setStatus('running', 'testing connection…');

  try {
    let ok = false;
    let reply = '';

    if (state.apiFormat === 'gemini') {
      const base = providerUrl.replace(/\/$/, '');
      const url = `${base}/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with only the word NISTE.' }] }],
          generationConfig: { maxOutputTokens: 16 }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || res.statusText);
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
      ok = true;

    } else if (state.apiFormat === 'claude') {
      const base = providerUrl.replace(/\/$/, '');
      const url = base.endsWith('/messages') ? base : base + '/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages:[{ role: 'user', content: 'Reply with only the word NISTE.' }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || res.statusText);
      reply = data.content?.[0]?.text || '(no text)';
      ok = true;

    } else {
      const base = providerUrl.replace(/\/$/, '');
      const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages:[{ role: 'user', content: 'Reply with only the word NISTE.' }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || res.statusText);
      reply = data.choices?.[0]?.message?.content || '(no text)';
      ok = true;
    }

    if (ok) {
      setStatus('done', 'connected · model replied: ' + reply.trim().substring(0, 40));
      toast('✓ Connected — ' + reply.trim().substring(0, 30), 'success');
      showTestFeedback(true, '✓ connected');
    }
  } catch(e) {
    setStatus('error', 'test failed: ' + e.message);
    toast('Test failed: ' + e.message.substring(0, 50), 'error');
    showTestFeedback(false, '✗ failed');
  }

  btn.textContent = 'Test';
  btn.disabled = false;
}

function showTestFeedback(pass, msg) {
  const fb = document.getElementById('testFeedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.className = 'test-feedback ' + (pass ? 'pass' : 'fail');
  clearTimeout(fb._timer);
  fb._timer = setTimeout(() => { fb.className = 'test-feedback'; }, 5000);
}

function stopGeneration() {
  if (abortController) abortController.abort();
}

function copyOutput() {
  if (!outputBuffer) { toast('Nothing to copy'); return; }
  navigator.clipboard.writeText(outputBuffer).then(() => toast('Copied to clipboard'));
}

function downloadJson() {
  if (!outputBuffer) { 
    toast('Nothing to download'); 
    return; 
  }

  let charName = "Unnamed_Character";
  const nameMatch = outputBuffer.match(/Name:\s*([^\n]+)/i);
  if (nameMatch && nameMatch[1]) {
    charName = nameMatch[1].trim().replace(/[^a-zA-Z0-9_\-\s]/g, '');
  }

  const cardData = {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: nameMatch ? nameMatch[1].trim() : "Unknown",
      description: outputBuffer, 
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "Generated via C-COS by @niste\n\nImage References: " + (imageDataArray.length > 0 ? imageDataArray.map(img => img.name).join(', ') : "None"),
      system_prompt: "",
      post_history_instructions: "",
      tags: ["C-COS"],
      creator: "",
      character_version: "1.0",
      alternate_greetings: []
    }
  };

  const firstMesSplit = outputBuffer.split(/FIRST MESSAGE \/ GREETING:|FIRST MESSAGE:|GREETING:/i);
  if (firstMesSplit.length > 1) {
    cardData.data.description = firstMesSplit[0].trim();
    cardData.data.first_mes = firstMesSplit[1].trim();
  }

  const dialogueSplit = cardData.data.description.split(/DIALOGUE EXAMPLES:|DIALOGUE:/i);
  if (dialogueSplit.length > 1) {
    cardData.data.description = dialogueSplit[0].trim();
    cardData.data.mes_example = dialogueSplit[1].trim();
  }

  const blob = new Blob([JSON.stringify(cardData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${charName}_CCOS.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  toast('↓ Card downloaded as JSON');
}

function clearOutput() {
  if (isEditing) toggleEditMode(true);
  
  outputBuffer = '';
  sessionGenerations = [];
  currentVersionIndex = -1;
  lastGenImageName = null;
  updateVersionUI();

  setOutput('awaiting generation', true);
  document.getElementById('outputBadge').style.display = 'none';
  document.getElementById('outputMeta').textContent = '';
  document.getElementById('tokenCount').textContent = '';
  setStatus('', 'ready');
}

function saveToHistory() {
  if (!outputBuffer) { toast('Nothing to save'); return; }
  const history = getHistory();
  const name = (imageDataArray[0]?.name || 'Unnamed card').replace(/\.[^.]+$/, '').substring(0, 50);
  history.unshift({
    id: Date.now(),
    name,
    output: outputBuffer,
    provider: state.apiFormat,
    model: state.model,
    date: new Date().toISOString()
  });
  if (history.length > 30) history.pop();
  localStorage.setItem('ccos_history', JSON.stringify(history));
  toast('Saved to history');
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('ccos_history') || '[]'); } catch(e) { return[]; }
}

function toggleHistory() {
  const modal = document.getElementById('historyModal');
  modal.classList.toggle('open');
  if (modal.classList.contains('open')) renderHistory();
}

function acceptTOS() {
  localStorage.setItem('ccos_tos_accepted', 'true');
  document.getElementById('tosModal').classList.remove('open');
}
function checkTOS() {
  if (!localStorage.getItem('ccos_tos_accepted')) {
    document.getElementById('tosModal').classList.add('open');
  }
}
function toggleTOS() {
  document.getElementById('tosModal').classList.toggle('open');
}
function studioAcceptTOS() { acceptTOS(); }
function studioCheckTOS()  { checkTOS(); }
function studioToggleTOS() { toggleTOS(); }

function renderHistory() {
  const list = document.getElementById('historyList');
  const history = getHistory();
  if (!history.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px;font-style:italic;">No saved cards yet</div>';
    return;
  }
  list.innerHTML = history.map(item => `
    <div class="history-item" onclick="loadHistoryItem(${item.id})">
      <div class="history-info">
        <div class="history-name" id="name-${item.id}">${escapeHtml(item.name)}</div>
        <div class="history-meta">${escapeHtml(item.provider)} · ${escapeHtml(item.model)} · ${new Date(item.date).toLocaleDateString()}</div>
      </div>
      <button class="history-del" onclick="event.stopPropagation();renameHistoryItem(${item.id})" title="Rename" style="font-size:12px;margin-right:2px;">✎</button>
      <button class="history-del" onclick="event.stopPropagation();deleteHistoryItem(${item.id})" title="Delete">×</button>
    </div>
  `).join('');
}

function loadHistoryItem(id) {
  if (isEditing) toggleEditMode(true);
  
  const item = getHistory().find(h => h.id === id);
  if (!item) return;
  outputBuffer = item.output;
  
  sessionGenerations = [item.output];
  currentVersionIndex = 0;
  lastGenImageName = null; 
  updateVersionUI();
  
  setOutput(item.output);
  toggleHistory();
  toast('Card loaded');
}

function deleteHistoryItem(id) {
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem('ccos_history', JSON.stringify(history));
  renderHistory();
}

function renameHistoryItem(id) {
  const history = getHistory();
  const item = history.find(h => h.id === id);
  if (!item) return;
  
  const newName = prompt('Rename card:', item.name);
  if (newName === null || newName.trim() === '') return;
  
  item.name = newName.trim().substring(0, 50);
  localStorage.setItem('ccos_history', JSON.stringify(history));
  renderHistory();
  toast('Renamed to: ' + item.name);
}

function openSettings() {
  if (window.innerWidth <= 1100) {
    showStudioPanel('studioPanelLeft');
  } else {
    document.getElementById('apiKey').focus();
    document.getElementById('apiKey').scrollIntoView({ behavior: 'smooth' });
  }
}

function dropZoneDragOver(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag-over');
}

function dropZoneDragLeave(e) {
  document.getElementById('dropZone').classList.remove('drag-over');
}

function dropZoneDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => {
    const allowed = ['image/png','image/jpeg','image/webp','image/gif'];
    return allowed.includes(f.type);
  });
  if (files.length) loadImageFiles(files);
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length) loadImageFiles(files);
  e.target.value = '';
}

function loadImageFiles(files) {
  const allowed = ['image/png','image/jpeg','image/webp','image/gif'];
  const validFiles = files.filter(f => allowed.includes(f.type));
  
  if (!validFiles.length) { toast('No valid images selected'); return; }
  
  let loaded = 0;
  validFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      imageDataArray.push({ base64, mimeType: file.type, name: file.name, dataUrl });
      loaded++;
      if (loaded === validFiles.length) {
        updateImagePreview();
        studioQueueDraftSave();
        updateGenBtnHint();
      }
    };
    reader.readAsDataURL(file);
  });
}

function updateImagePreview() {
  const grid = document.getElementById('previewGrid');
  const nameEl = document.getElementById('previewName');
  
  grid.innerHTML = imageDataArray.map((img, idx) => `
    <div class="drop-preview-item">
      <img src="${img.dataUrl}" alt="preview">
      <button class="preview-remove" onclick="event.stopPropagation();removeImage(${idx})" title="Remove">×</button>
    </div>
  `).join('');
  
  const totalSize = imageDataArray.reduce((sum, img) => {
    return sum + (img.base64.length * 0.75);
  }, 0);
  const sizeText = totalSize > 1024*1024 
    ? (totalSize/1024/1024).toFixed(1)+'MB' 
    : Math.round(totalSize/1024)+'KB';
  
  nameEl.textContent = `${imageDataArray.length} image${imageDataArray.length > 1 ? 's' : ''} · ${sizeText}`;
  
  document.getElementById('dropIdle').style.display = 'none';
  document.getElementById('dropPreview').style.display = 'flex';
}

function removeImage(index) {
  imageDataArray.splice(index, 1);
  if (imageDataArray.length === 0) {
    clearAllImages();
  } else {
    updateImagePreview();
    studioQueueDraftSave();
  }
}

function clearAllImages() {
  imageDataArray = [];
  document.getElementById('previewGrid').innerHTML = '';
  document.getElementById('previewName').textContent = '';
  document.getElementById('dropIdle').style.display = 'flex';
  document.getElementById('dropPreview').style.display = 'none';
  studioQueueDraftSave();
  updateGenBtnHint();
}

function clearImage() { clearAllImages(); }

function loadImageFile(file) { loadImageFiles([file]); }

function studioQueueDraftSave() {
  if (draftSaveTimeout) clearTimeout(draftSaveTimeout);
  draftSaveTimeout = setTimeout(saveDraft, 1000);
  updateStepIndicator();
  updateGenBtnHint();
}

function saveDraft() {
  const context = document.getElementById('contextInput').value;
  const override = document.getElementById('overrideInput').value;
  
  if (imageDataArray.length === 0 && !context && !override) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  
  const draft = {
    images: imageDataArray,
    context: context,
    override: override,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    showDraftStatus('saved');
  } catch (e) {
    showDraftStatus('error');
  }
}

function loadDraft() {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return false;
    
    const draft = JSON.parse(saved);
    
    if (draft.images && draft.images.length > 0) {
      imageDataArray = draft.images;
      updateImagePreview();
    }
    
    if (draft.context) {
      document.getElementById('contextInput').value = draft.context;
    }
    if (draft.override) {
      document.getElementById('overrideInput').value = draft.override;
    }
    
    const age = Math.round((Date.now() - draft.timestamp) / 60000); 
    const ageText = age < 1 ? 'just now' : age < 60 ? `${age}m ago` : `${Math.round(age/60)}h ago`;
    toast(`Restored draft from ${ageText}`);
    
    return true;
  } catch (e) {
    return false;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  showDraftStatus('cleared');
}

function showDraftStatus(status) {
  const statusEl = document.getElementById('draftStatus');
  if (!statusEl) return;
  
  if (status === 'saved') {
    statusEl.textContent = 'draft saved';
    statusEl.style.opacity = '1';
    setTimeout(() => { statusEl.style.opacity = '0'; }, 2000);
  } else if (status === 'error') {
    statusEl.textContent = 'draft too large';
    statusEl.style.opacity = '1';
    setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
  }
}

function showStudioPanel(panelId) {
  const isMobile = window.innerWidth <= 1100;
  const panels = ['studioPanelLeft', 'studioPanelCenter', 'studioPanelRight'];

  panels.forEach(id => {
    const el = document.getElementById(id);
    if (isMobile) {
      el.style.display = id === panelId ? 'flex' : 'none';
    } else {
      el.style.display = '';
    }
  });

  document.getElementById('navBtnLeft').classList.toggle('active', panelId === 'studioPanelLeft');
  document.getElementById('navBtnCenter').classList.toggle('active', panelId === 'studioPanelCenter');
  document.getElementById('navBtnRight').classList.toggle('active', panelId === 'studioPanelRight');

  window.scrollTo(0, 0);
}

window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 1100;
  if (!isMobile) {
    ['studioPanelLeft', 'studioPanelCenter', 'studioPanelRight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  }
});

function studioToggleTheme() {
    currentTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    studioApplyTheme(currentTheme);
    localStorage.setItem('ccos_theme', currentTheme);
}

function studioApplyTheme(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.textContent = 'dark';
    } else {
        document.body.removeAttribute('data-theme');
        if (themeToggle) themeToggle.textContent = 'light';
    }
}

function studioLoadTheme() {
    const savedTheme = localStorage.getItem('ccos_theme') || 'dark';
    studioApplyTheme(savedTheme);
}

window.addEventListener('click', e => {
  const hModal = document.getElementById('historyModal');
  const sModal = document.getElementById('supportModal');
  const tModal = document.getElementById('tosModal');
  if (e.target === hModal) toggleHistory();
});

studioCheckTOS(); 
loadConfig();
studioLoadTheme();
loadDraft(); 

var entries = [];          
var activeEntryId = null;
var exportFormat = 'tavern';
var assistResult = null;
var codexDraftTimeout = null;
var globalSettings = {
  recursive: false,
  case: false,
  scanDepth: 4,
};

function newEntry(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    name: '',
    keys: [],
    secKeys: [],
    content: '',
    category: 'world',
    enabled: true,
    caseSensitive: false,
    useRegex: false,
    order: 100,
    scanDepth: 4,
    position: 'before_char',
    priority: 10,
    ...overrides
  };
}

var STORE_KEY = 'ccos_codex_v1';
var CONFIG_KEY = 'ccos_codex_config';

function saveEntries() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); } catch(e) {}
  updateStats();
  updateEntryCount();
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch(e) { entries = []; }
}

function codexSaveConfig() {
  const cfg = {
    lorebookName: document.getElementById('lorebookName').value,
    lorebookDesc: document.getElementById('lorebookDesc').value,
    globalScanDepth: document.getElementById('globalScanDepth').value,
    recursive: globalSettings.recursive,
    case: globalSettings.case,
    exportFormat,
    theme: document.body.getAttribute('data-theme') || 'dark',
  };
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch(e) {}
  codexUpdateApiStatus();
}

function codexLoadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (cfg.lorebookName) document.getElementById('lorebookName').value = cfg.lorebookName;
    if (cfg.lorebookDesc) document.getElementById('lorebookDesc').value = cfg.lorebookDesc;
    if (cfg.globalScanDepth) {
      document.getElementById('globalScanDepth').value = cfg.globalScanDepth;
      document.getElementById('globalScanDepthVal').textContent = cfg.globalScanDepth;
    }
    if (cfg.recursive) {
      globalSettings.recursive = cfg.recursive;
      if (cfg.recursive) document.getElementById('toggleRecursive').classList.add('on');
    }
    if (cfg.case) {
      globalSettings.case = cfg.case;
      if (cfg.case) document.getElementById('toggleGlobalCase').classList.add('on');
    }
    if (cfg.exportFormat) setFormat(cfg.exportFormat, true);
    if (cfg.theme) codexApplyTheme(cfg.theme);
  } catch(e) {}
  codexUpdateApiStatus();
}

function renderEntries(filter = '') {
  const list = document.getElementById('entriesList');
  const empty = document.getElementById('entriesEmpty');
  const filtered = entries.filter(e =>
    !filter ||
    e.name.toLowerCase().includes(filter) ||
    (e.keys || []).some(k => k.toLowerCase().includes(filter)) ||
    e.content.toLowerCase().includes(filter)
  );

  if (filtered.length === 0) {
    empty.style.display = 'flex';
    list.querySelectorAll('.entry-item').forEach(el => el.remove());
    return;
  }

  empty.style.display = 'none';
  list.querySelectorAll('.entry-item').forEach(el => el.remove());

  filtered.forEach((entry, idx) => {
    const el = document.createElement('div');
    el.className = 'entry-item' + (entry.id === activeEntryId ? ' active' : '');
    el.dataset.id = entry.id;
    el.draggable = true;

    const disabledStyle = !entry.enabled ? 'opacity:0.45;' : '';
    const catColor = getCatColor(entry.category);

    el.innerHTML = `
      <div class="entry-order">${idx + 1}</div>
      <div class="entry-item-body" style="${disabledStyle}">
        <div class="entry-item-name">${entry.name ? escapeHtml(entry.name) : '<em style="opacity:0.4">unnamed entry</em>'}</div>
        <div class="entry-item-keys">${(entry.keys || []).length ? (entry.keys || []).slice(0,4).map(k => escapeHtml(k)).join(', ') + ((entry.keys || []).length > 4 ? ' …' : '') : '<em style="opacity:0.35">no keys</em>'}</div>
        <div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;">
          ${entry.category ? `<span class="badge" style="background:${catColor.bg};color:${catColor.fg};">${escapeHtml(entry.category)}</span>` : ''}
          ${!entry.enabled ? '<span class="badge badge-red">off</span>' : ''}
        </div>
      </div>
      <button class="entry-item-del" onclick="event.stopPropagation();deleteEntry('${entry.id}')" title="Delete">×</button>
    `;

    el.addEventListener('click', () => selectEntry(entry.id));
    el.addEventListener('dragstart', e => handleDragStart(e, entry.id));
    el.addEventListener('dragover', e => handleDragOver(e));
    el.addEventListener('dragleave', e => handleDragLeave(e));
    el.addEventListener('drop', e => handleDrop(e, entry.id));
    el.addEventListener('dragend', e => handleDragEnd(e));

    list.appendChild(el);
  });

  updateEntryCount();
}

function getCatColor(cat) {
  const map = {
    world:     { bg: 'rgba(90,122,158,0.15)', fg: '#5a7a9e' },
    character: { bg: 'rgba(196,163,90,0.15)', fg: '#c4a35a' },
    lore:      { bg: 'rgba(139,111,62,0.2)',  fg: '#c4a35a' },
    location:  { bg: 'rgba(90,158,122,0.15)', fg: '#5a9e7a' },
    item:      { bg: 'rgba(158,90,158,0.15)', fg: '#9e5a9e' },
    custom:    { bg: 'rgba(158,90,90,0.15)',  fg: '#c45a5a' },
  };
  return map[cat] || { bg: 'rgba(155,150,144,0.1)', fg: '#a39e99' };
}

function updateEntryCount() {
  document.getElementById('entryCount').textContent = entries.length;
}

function filterEntries() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  renderEntries(q);
}

function selectEntry(id) {
  activeEntryId = id;
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  document.getElementById('editorEmpty').style.display = 'none';
  document.getElementById('editorFields').classList.remove('hidden');
  document.getElementById('editorTitle').textContent = entry.name || 'unnamed entry';

  document.getElementById('entryName').value = entry.name || '';
  document.getElementById('entryContent').value = entry.content || '';
  document.getElementById('entryOrder').value = entry.order ?? 100;
  document.getElementById('scanDepth').value = entry.scanDepth ?? 4;
  document.getElementById('scanDepthVal').textContent = entry.scanDepth ?? 4;
  document.getElementById('entryPosition').value = entry.position || 'before_char';
  document.getElementById('entryPriority').value = entry.priority ?? 10;
  document.getElementById('entryPriorityVal').textContent = entry.priority ?? 10;

  document.getElementById('toggleEnabled').classList.toggle('on', !!entry.enabled);
  document.getElementById('toggleCase').classList.toggle('on', !!entry.caseSensitive);
  document.getElementById('toggleRegex').classList.toggle('on', !!entry.useRegex);

  renderKeyTags(entry.keys || [], 'keysWrap', 'keyInput');
  renderKeyTags(entry.secKeys || [], 'secKeysWrap', 'secKeyInput');

  document.querySelectorAll('#categoryPills .cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === entry.category);
  });

  renderEntries(document.getElementById('searchInput').value.toLowerCase());
  updateTokenCount();

  if (window.innerWidth <= 1000) showCodexPanel('codexPanelCenter');
}

function renderKeyTags(keys, wrapId, inputId) {
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  if (!wrap || !input) return;
  wrap.querySelectorAll('.key-tag').forEach(t => t.remove());
  (keys || []).forEach((k, i) => {
    const tag = document.createElement('div');
    tag.className = 'key-tag';
    tag.innerHTML = `${escapeHtml(k)}<button onclick="removeKey('${wrapId}',${JSON.stringify(k).replace(/"/g, '&quot;')})">×</button>`;
    wrap.insertBefore(tag, input);
  });
}

function handleKeyInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val) addKeyToEntry(val, 'keysWrap', 'keyInput', 'keys');
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value) {
    const entry = getActiveEntry();
    if (entry && (entry.keys || []).length) {
      entry.keys.pop();
      renderKeyTags(entry.keys || [], 'keysWrap', 'keyInput');
      saveEntries();
    }
  }
}

function handleSecKeyInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val) addKeyToEntry(val, 'secKeysWrap', 'secKeyInput', 'secKeys');
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value) {
    const entry = getActiveEntry();
    if (entry && (entry.secKeys || []).length) {
      entry.secKeys.pop();
      renderKeyTags(entry.secKeys || [], 'secKeysWrap', 'secKeyInput');
      saveEntries();
    }
  }
}

function addKeyToEntry(val, wrapId, inputId, field) {
  const entry = getActiveEntry();
  if (!entry) return;
  if (!entry[field]) entry[field] = [];
  if (!entry[field].includes(val)) {
    entry[field].push(val);
    renderKeyTags(entry[field], wrapId, inputId);
    saveEntries();
  }
}

function removeKey(wrapId, key) {
  const entry = getActiveEntry();
  if (!entry) return;
  const field = wrapId === 'keysWrap' ? 'keys' : 'secKeys';
  entry[field] = (entry[field] || []).filter(k => k !== key);
  renderKeyTags(entry[field], wrapId, wrapId === 'keysWrap' ? 'keyInput' : 'secKeyInput');
  saveEntries();
}

function updateActiveEntry() {
  const entry = getActiveEntry();
  if (!entry) return;
  entry.name = document.getElementById('entryName').value;
  entry.content = document.getElementById('entryContent').value;
  entry.order = parseInt(document.getElementById('entryOrder').value) || 100;
  entry.scanDepth = parseInt(document.getElementById('scanDepth').value) || 4;
  entry.position = document.getElementById('entryPosition').value;
  entry.priority = parseInt(document.getElementById('entryPriority').value) || 10;
  document.getElementById('editorTitle').textContent = entry.name || 'unnamed entry';
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
  codexQueueDraftSave();
}

function toggleEntryField(field) {
  const entry = getActiveEntry();
  if (!entry) return;
  entry[field] = !entry[field];
  const toggleMap = { enabled: 'toggleEnabled', caseSensitive: 'toggleCase', useRegex: 'toggleRegex' };
  document.getElementById(toggleMap[field]).classList.toggle('on', entry[field]);
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
}

function setCategory(cat) {
  const entry = getActiveEntry();
  if (!entry) return;
  entry.category = cat;
  document.querySelectorAll('#categoryPills .cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
}

function getActiveEntry() {
  return entries.find(e => e.id === activeEntryId) || null;
}

function updateTokenCount() {
  const content = document.getElementById('entryContent').value;
  const tokens = Math.ceil(content.length / 4);
  const pill = document.getElementById('entryTokens');
  pill.textContent = tokens + ' tokens';
  pill.className = 'token-pill' + (tokens > 400 ? ' danger' : tokens > 200 ? ' warn' : '');
}

function addEntry() {
  const entry = newEntry({ name: '', order: entries.length > 0 ? Math.max(...entries.map(e => e.order)) + 10 : 100 });
  entries.push(entry);
  saveEntries();
  renderEntries();
  selectEntry(entry.id);
  setTimeout(() => document.getElementById('entryName').focus(), 50);
  toast('New entry created');
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id != id);
  if (activeEntryId == id) {
    activeEntryId = entries.length ? entries[entries.length - 1].id : null;
    if (activeEntryId) {
      selectEntry(activeEntryId);
    } else {
      document.getElementById('editorEmpty').style.display = 'flex';
      document.getElementById('editorFields').classList.add('hidden');
    }
  }
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
  toast('Entry deleted');
}

function duplicateEntry() {
  const entry = getActiveEntry();
  if (!entry) { toast('No entry selected'); return; }
  const dup = { ...entry, id: Date.now() + Math.random(), name: entry.name + ' (copy)', keys: [...(entry.keys || [])], secKeys: [...(entry.secKeys || [])] };
  const idx = entries.findIndex(e => e.id === entry.id);
  entries.splice(idx + 1, 0, dup);
  saveEntries();
  renderEntries();
  selectEntry(dup.id);
  toast('Entry duplicated');
}

function clearAll() {
  if (!confirm('Nuke all entries? This cannot be undone.')) return;
  entries = [];
  activeEntryId = null;
  document.getElementById('editorEmpty').style.display = 'flex';
  document.getElementById('editorFields').classList.add('hidden');
  saveEntries();
  renderEntries();
  toast('Lorebook nuked, thank you for your service.');
}

function bulkEnable(state) {
  entries.forEach(e => e.enabled = state);
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
  if (activeEntryId) {
    document.getElementById('toggleEnabled').classList.toggle('on', state);
  }
  toast(state ? 'All entries enabled' : 'All entries disabled');
}

function sortEntries(by) {
  if (by === 'name') {
    entries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else {
    entries.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
  toast('Sorted by ' + (by === 'name' ? 'name' : 'insertion order'));
}

var dragId = null;

function handleDragStart(e, id) {
  dragId = id;
  e.currentTarget.classList.add('drag-ghost');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  el.classList.remove('drag-over-top', 'drag-over-bottom');
  if (e.clientY < mid) el.classList.add('drag-over-top');
  else el.classList.add('drag-over-bottom');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
  if (dragId == targetId) return;
  const fromIdx = entries.findIndex(e => e.id == dragId);
  const toIdx = entries.findIndex(e => e.id == targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = entries.splice(fromIdx, 1);
  const rect = e.currentTarget.getBoundingClientRect();
  const insertAfter = e.clientY > rect.top + rect.height / 2;
  const newIdx = insertAfter ? Math.min(toIdx, entries.length) : toIdx;
  entries.splice(newIdx, 0, moved);
  saveEntries();
  renderEntries(document.getElementById('searchInput').value.toLowerCase());
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('drag-ghost');
  document.querySelectorAll('.entry-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function updateStats() {
  document.getElementById('statEntries').textContent = entries.length;
  document.getElementById('statEnabled').textContent = entries.filter(e => e.enabled).length;
  const totalTokens = entries.reduce((sum, e) => sum + Math.ceil((e.content || '').length / 4), 0);
  document.getElementById('statTokens').textContent = totalTokens > 1000 ? (totalTokens/1000).toFixed(1)+'k' : totalTokens;
}

function setFormat(fmt, silent = false) {
  exportFormat = fmt;
  document.querySelectorAll('#formatChips .format-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.fmt === fmt);
  });
  if (!silent) codexSaveConfig();
}

function buildExportData() {
  if (exportFormat === 'tavern') return buildTavernExport();
  if (exportFormat === 'janitor') return buildJanitorExport();
  if (exportFormat === 'agnai') return buildAgnaiExport();
  if (exportFormat === 'kobold') return buildKoboldExport();
  return {};
}

function buildTavernExport() {
  const name = document.getElementById('lorebookName').value || 'Codex Lorebook';
  const desc = document.getElementById('lorebookDesc').value || '';
  const entriesObj = {};
  entries.forEach((e, i) => {
    entriesObj[i] = {
      uid: i,
      key: e.keys || [],
      keysecondary: e.secKeys || [],
      comment: e.name,
      content: e.content,
      constant: false,
      selective: (e.secKeys || []).length > 0,
      addMemo: true,
      order: e.order,
      position: positionToTavern(e.position),
      disable: !e.enabled,
      useProbability: false,
      probability: 100,
      depth: e.scanDepth,
      group: e.category,
      caseSensitive: e.caseSensitive,
      useRegex: e.useRegex,
      priority: e.priority,
    };
  });
  return {
    name, description: desc,
    scan_depth: parseInt(document.getElementById('globalScanDepth').value),
    token_budget: 2048,
    recursive_scanning: globalSettings.recursive,
    case_sensitive: globalSettings.case,
    extensions: { codex_version: '1.0' },
    entries: entriesObj,
  };
}

function positionToTavern(pos) {
  const map = {
    before_char: 0, after_char: 1,
    before_example: 2, after_example: 3,
    top_an: 4, bottom_an: 5,
  };
  return map[pos] ?? 0;
}

function buildJanitorExport() {
  return {
    world_info: entries.map((e, i) => ({
      uid: i,
      key: (e.keys || []).join(','),
      keysecondary: (e.secKeys || []).join(','),
      comment: e.name,
      content: e.content,
      selective: (e.secKeys || []).length > 0,
      constant: false,
      order: e.order,
      disable: !e.enabled,
    }))
  };
}

function buildAgnaiExport() {
  return {
    kind: 'memory-book',
    name: document.getElementById('lorebookName').value || 'Codex Lorebook',
    description: document.getElementById('lorebookDesc').value,
    entries: entries.map((e, i) => ({
      name: e.name,
      entry: e.content,
      keywords: e.keys || [],
      priority: e.priority,
      weight: 10,
      enabled: e.enabled,
    }))
  };
}

function buildKoboldExport() {
  return {
    entries: Object.fromEntries(entries.map((e, i) => [i, {
      key: e.keys || [],
      keysecondary: e.secKeys || [],
      content: e.content,
      comment: e.name,
      selective: (e.secKeys || []).length > 0,
      constant: false,
      order: e.order,
      disable: !e.enabled,
    }]))
  };
}

function codexOpenExportModal() {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  document.getElementById('exportPreview').textContent = json.substring(0, 2000) + (json.length > 2000 ? '\n\n… (truncated for preview)' : '');
  const labels = { tavern: 'SillyTavern', janitor: 'Janitor AI', agnai: 'Agnai', kobold: 'KoboldAI' };
  document.getElementById('exportFormatLabel').textContent = labels[exportFormat] || exportFormat;
  document.getElementById('exportModal').classList.add('open');
}

function codexCloseExportModal() {
  document.getElementById('exportModal').classList.remove('open');
}

function codexCopyExport() {
  const data = buildExportData();
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  toast('JSON copied to clipboard');
}

function codexDownloadExport() {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = document.getElementById('lorebookName').value || 'codex-lorebook';
  a.href = url;
  a.download = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Lorebook downloaded');
}

function codexImportLorebook() {
  document.getElementById('importJson').value = '';
  document.getElementById('importError').style.display = 'none';
  document.getElementById('importModal').classList.add('open');
}

function codexCloseImportModal() {
  document.getElementById('importModal').classList.remove('open');
}

function doImport() {
  const raw = document.getElementById('importJson').value.trim();
  const errEl = document.getElementById('importError');
  errEl.style.display = 'none';

  try {
    const data = JSON.parse(raw);
    let imported = [];

    if (data.entries && typeof data.entries === 'object') {
      const ents = Array.isArray(data.entries) ? data.entries : Object.values(data.entries);
      imported = ents.map(e => newEntry({
        name: e.comment || e.name || '',
        keys: Array.isArray(e.key) ? e.key : (e.key || '').split(',').map(k => k.trim()).filter(Boolean),
        secKeys: Array.isArray(e.keysecondary) ? e.keysecondary : (e.keysecondary || '').split(',').map(k => k.trim()).filter(Boolean),
        content: e.content || '',
        enabled: !e.disable,
        order: e.order ?? 100,
        scanDepth: e.depth ?? 4,
        priority: e.priority ?? 10,
      }));
    }
    else if (data.world_info && Array.isArray(data.world_info)) {
      imported = data.world_info.map(e => newEntry({
        name: e.comment || '',
        keys: (e.key || '').split(',').map(k => k.trim()).filter(Boolean),
        secKeys: (e.keysecondary || '').split(',').map(k => k.trim()).filter(Boolean),
        content: e.content || '',
        enabled: !e.disable,
        order: e.order ?? 100,
      }));
    }
    else if (data.kind === 'memory-book' && Array.isArray(data.entries)) {
      imported = data.entries.map(e => newEntry({
        name: e.name || '',
        keys: Array.isArray(e.keywords) ? e.keywords : [],
        content: e.entry || '',
        enabled: e.enabled !== false,
        priority: e.priority ?? 10,
      }));
    }

    if (!imported.length) {
      errEl.textContent = 'Could not find any entries in the JSON.';
      errEl.style.display = 'block';
      return;
    }

    if (entries.length > 0 && !confirm(`Add ${imported.length} entries to existing ${entries.length} entries? (OK to merge, Cancel to replace)`)) {
      entries = imported;
    } else {
      entries = [...entries, ...imported];
    }

    saveEntries();
    renderEntries();
    codexCloseImportModal();
    if (imported[0]) selectEntry(imported[0].id);
    toast(`Imported ${imported.length} entries`);

  } catch(e) {
    errEl.textContent = 'Invalid JSON: ' + e.message;
    errEl.style.display = 'block';
  }
}

async function aiAssistEntry() {
  const entry = getActiveEntry();
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { toast('Add an API key in Studio Configuration'); return; }

  const mode = document.getElementById('assistMode').value;
  const context = document.getElementById('assistContext').value.trim();

  const btn = document.getElementById('assistBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="assist-star" style="animation:spin 0.8s linear infinite;display:inline-block;">✦</span> generating…';

  const prompts = {
    expand: `You are a world-building assistant. Expand the following lorebook entry content to be more detailed, vivid, and useful for AI roleplay. Keep it factual and in-universe. Return only the expanded content text, no preamble.\n\nEntry name: ${entry?.name || 'untitled'}\nCurrent content: ${entry?.content || '(empty)'}\n${context ? 'Genre/context: ' + context : ''}`,
    keys: `Suggest 5-10 trigger keywords/phrases for this lorebook entry. Return a JSON array of strings only, no explanation.\n\nEntry name: ${entry?.name || 'untitled'}\nContent: ${entry?.content || '(empty)'}`,
    rewrite: `Rewrite this lorebook entry content to be optimized for AI language model injection. Use concise, factual prose. Avoid vague language. Return only the rewritten content.\n\nEntry name: ${entry?.name || 'untitled'}\nContent: ${entry?.content || '(empty)'}`,
    split: `Split the following lorebook entry into 2-4 separate focused entries. Return as JSON array with objects like {name, keys, content}.\n\nEntry name: ${entry?.name || 'untitled'}\nContent: ${entry?.content || '(empty)'}`,
    worldbuild: `Generate a detailed lorebook entry for: "${entry?.name || document.getElementById('entryName').value || 'unknown'}". ${context ? 'Genre: ' + context + '.' : ''} Return only the entry content text, factual, in-universe, 100-200 words.`,
  };

  try {
    const providerUrl = document.getElementById('providerUrl').value.trim() || 'https://api.anthropic.com/v1';
    const apiModel = document.getElementById('modelSelect').value.trim() || 'claude-3-5-sonnet-20241022';
    
    let proxyTarget = providerUrl;
    if (!proxyTarget.endsWith('/messages') && !proxyTarget.endsWith('/chat/completions')) {
      proxyTarget = proxyTarget.replace(/\/$/, '') + '/messages';
    }

    const response = await fetch(proxyTarget, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': 'Bearer ' + apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: apiModel,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompts[mode] }],
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || data.choices?.[0]?.message?.content || '';

    assistResult = { mode, text };

    document.getElementById('assistOutput').textContent = text;
    document.getElementById('assistModal').classList.add('open');

  } catch(e) {
    toast('AI error: ' + e.message);
  }

  btn.classList.remove('loading');
  btn.innerHTML = '<span class="assist-star">✦</span> AI Assist';
}

function closeAssistModal() {
  document.getElementById('assistModal').classList.remove('open');
  assistResult = null;
}

function applyAssist() {
  if (!assistResult) return;
  const entry = getActiveEntry();
  if (!entry) return;

  const { mode, text } = assistResult;

  if (mode === 'keys') {
    try {
      const keys = JSON.parse(text);
      if (Array.isArray(keys)) {
        entry.keys = [...new Set([...(entry.keys || []), ...keys.map(k => k.trim()).filter(Boolean)])];
        renderKeyTags(entry.keys || [], 'keysWrap', 'keyInput');
        saveEntries();
        toast('Keys applied');
      }
    } catch(e) { toast('Could not parse keys JSON'); }
  } else if (mode === 'split') {
    try {
      let arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        const idx = entries.findIndex(e => e.id === entry.id);
        const newEntries = arr.map((e, i) => newEntry({
          name: e.name || '',
          keys: Array.isArray(e.keys) ? e.keys : [],
          content: e.content || '',
          order: entry.order + i,
        }));
        entries.splice(idx, 1, ...newEntries);
        saveEntries();
        renderEntries();
        if (newEntries[0]) selectEntry(newEntries[0].id);
        toast('Entry split into ' + newEntries.length);
      }
    } catch(e) { toast('Could not parse split JSON'); }
  } else {
    entry.content = text;
    document.getElementById('entryContent').value = text;
    saveEntries();
    updateTokenCount();
    toast('Content applied');
  }

  closeAssistModal();
}

async function autoGenerateKeys() {
  const entry = getActiveEntry();
  if (!entry) { toast('No entry selected'); return; }
  document.getElementById('assistMode').value = 'keys';
  await aiAssistEntry();
}

function toggleGlobal(field) {
  globalSettings[field] = !globalSettings[field];
  const toggleMap = { recursive: 'toggleRecursive', case: 'toggleGlobalCase' };
  document.getElementById(toggleMap[field]).classList.toggle('on', globalSettings[field]);
  codexSaveConfig();
}

function codexQueueDraftSave() {
  if (codexDraftTimeout) clearTimeout(codexDraftTimeout);
  codexDraftTimeout = setTimeout(() => {
    saveEntries();
    const el = document.getElementById('codexDraftStatus');
    el.textContent = 'saved';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 1500);
  }, 800);
}

function codexToggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  codexApplyTheme(current === 'light' ? 'dark' : 'light');
  codexSaveConfig();
}

function codexApplyTheme(theme) {
  const btn = document.getElementById('themeToggle');
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    if (btn) btn.textContent = 'dark';
  } else {
    document.body.removeAttribute('data-theme');
    if (btn) btn.textContent = 'light';
  }
}

function codexUpdateApiStatus() {
  const codexKeyEl = document.getElementById('codexApiKey');
  const studioKeyEl = document.getElementById('apiKey');
  const key = (codexKeyEl ? codexKeyEl.value.trim() : '') || (studioKeyEl ? studioKeyEl.value.trim() : '');
  const dot = document.getElementById('codexApiDot');
  const status = document.getElementById('codexApiStatus');
  if (dot) dot.classList.toggle('active', !!key);
  if (status) status.textContent = key ? 'key set' : 'no key';
}

function codexToggleKeyVis() {
  const inp = document.getElementById('codexApiKey');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showCodexPanel(panelId) {
  const isMobile = window.innerWidth <= 1000;
  const panels = ['codexPanelLeft', 'codexPanelCenter', 'codexPanelRight'];

  panels.forEach(id => {
    const el = document.getElementById(id);
    if (isMobile) {
      el.style.display = id === panelId ? 'flex' : 'none';
    } else {
      el.style.display = '';
    }
  });

  ['codexNavBtnLeft', 'codexNavBtnCenter', 'codexNavBtnRight'].forEach((btnId, i) => {
    document.getElementById(btnId).classList.toggle('active', panels[i] === panelId);
  });

  window.scrollTo(0, 0);
}

function codexToggleTOS() { toggleTOS(); }
function codexAcceptTOS() { acceptTOS(); }
function codexCheckTOS()  { checkTOS(); }

window.addEventListener('click', e => {
  if (e.target === document.getElementById('exportModal')) codexCloseExportModal();
  if (e.target === document.getElementById('assistModal')) closeAssistModal();
  if (e.target === document.getElementById('importModal')) codexCloseImportModal();
});

codexCheckTOS();
codexLoadConfig();
loadEntries();
renderEntries();
updateStats();
codexUpdateApiStatus();

(function initApp() {
  const savedMode = localStorage.getItem('ccos_mode') || 'studio';
  switchMode(savedMode);

  checkTOS();
  loadConfig();
  studioLoadTheme();
  loadDraft();

  codexLoadConfig();
  loadEntries();
  renderEntries();
  updateStats();
  codexUpdateApiStatus();

  loadSectionStates();
  checkOnboarding();
  updateGenBtnHint();

  window.addEventListener('click', e => {
    const hModal = document.getElementById('historyModal');
    const sModal = document.getElementById('supportModal');
    if (e.target === hModal) toggleHistory();
    if (e.target === sModal) toggleSupport();
    if (e.target === document.getElementById('exportModal')) codexCloseExportModal();
    if (e.target === document.getElementById('assistModal')) closeAssistModal();
    if (e.target === document.getElementById('importModal')) codexCloseImportModal();
  });
})();

studioLoadTheme = function() { loadTheme(); };
studioApplyTheme = function(t) { applyTheme(t); };
studioToggleTheme = function() { toggleTheme(); };
codexApplyTheme = function(t) { applyTheme(t); };
codexToggleTheme = function() { toggleTheme(); };

loadTheme();

var batchQueue = []; 
var batchRunning = false;
var batchAbort = false;

function openBatchModal() {
  renderBatchQueue();
  document.getElementById('batchModal').classList.add('open');
}
function closeBatchModal() {
  document.getElementById('batchModal').classList.remove('open');
}

function handleBatchDrop(e) {
  e.preventDefault();
  document.getElementById('batchDropZone').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => ['image/png','image/jpeg','image/webp','image/gif'].includes(f.type));
  if (files.length) addBatchFiles(files);
}
function handleBatchFileSelect(e) {
  const files = Array.from(e.target.files);
  addBatchFiles(files);
  e.target.value = '';
}

function addBatchFiles(files) {
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = evt => {
      const dataUrl = evt.target.result;
      const base64 = dataUrl.split(',')[1];
      batchQueue.push({ base64, mimeType: file.type, name: file.name, dataUrl, status: 'pending', result: '' });
      loaded++;
      if (loaded === files.length) renderBatchQueue();
    };
    reader.readAsDataURL(file);
  });
}

function clearBatchQueue() {
  if (batchRunning) { toast('Stop batch first'); return; }
  batchQueue = [];
  renderBatchQueue();
}

function renderBatchQueue() {
  const container = document.getElementById('batchQueue');
  if (!batchQueue.length) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:var(--font-xs);font-style:italic;">Queue empty — drop images above</div>';
    return;
  }
  container.innerHTML = batchQueue.map((item, i) => `
    <div class="batch-row ${item.status}" id="batchRow${i}">
      <img class="batch-thumb" src="${item.dataUrl}" alt="">
      <div class="batch-info">
        <div class="batch-name">${escapeHtml(item.name)}</div>
        <div class="batch-status"><span class="batch-status-dot"></span>${
          item.status === 'pending' ? 'Pending' :
          item.status === 'running' ? 'Generating…' :
          item.status === 'done'    ? '✓ Done · saved to history' :
          '✗ Error: ' + escapeHtml(item.error || 'unknown')
        }</div>
      </div>
      ${item.status === 'pending' ? `<button class="icon-btn" style="width:28px;height:28px;font-size:12px;" onclick="removeBatchItem(${i})" title="Remove">×</button>` : ''}
    </div>
  `).join('');
}

function removeBatchItem(i) {
  batchQueue.splice(i, 1);
  renderBatchQueue();
}

async function runBatch() {
  if (batchRunning) { batchAbort = true; document.querySelector('#batchRunBtn span').textContent = 'Run Batch'; batchRunning = false; return; }
  const key = document.getElementById('apiKey').value.trim();
  const providerUrl = document.getElementById('providerUrl').value.trim();
  if (!providerUrl || !key) { toast('Set API key and URL first', 'error'); return; }
  if (!batchQueue.length) { toast('Add images to the queue first', 'error'); return; }
  const pending = batchQueue.filter(b => b.status === 'pending');
  if (!pending.length) { toast('No pending items — clear queue to restart', 'error'); return; }

  batchRunning = true;
  batchAbort = false;
  document.querySelector('#batchRunBtn span').textContent = 'Stop';
  document.getElementById('batchProgressBar').style.display = 'block';

  const delay = parseInt(document.getElementById('batchDelay').value) * 1000;
  const total = pending.length;
  let done = 0;

  for (let i = 0; i < batchQueue.length; i++) {
    if (batchAbort) break;
    const item = batchQueue[i];
    if (item.status !== 'pending') continue;

    item.status = 'running';
    renderBatchQueue();
    document.getElementById('batchStatusText').textContent = `${done + 1} / ${total}`;

    const savedImages = [...imageDataArray];
    imageDataArray = [{ base64: item.base64, mimeType: item.mimeType, name: item.name, dataUrl: item.dataUrl }];

    let batchBuffer = '';
    const origSetOutput = window.setOutput;
    window.setOutput = (text, empty) => { batchBuffer = text || ''; };

    const savedAbort = abortController;
    abortController = new AbortController();
    const maxTok = state.jllmMode ? 2000 : state.maxTokens;

    try {
      if (state.apiFormat === 'gemini') await generateGemini(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTok);
      else if (state.apiFormat === 'claude') await generateClaude(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTok);
      else await generateOpenAI(key, providerUrl, buildSystemPrompt(), buildUserMessage(), maxTok);

      item.status = 'done';
      item.result = outputBuffer;

      const history = getHistory();
      history.unshift({ id: Date.now(), name: item.name.replace(/\.[^.]+$/, '').substring(0, 50), output: outputBuffer, provider: state.apiFormat, model: state.model, date: new Date().toISOString() });
      if (history.length > 30) history.pop();
      localStorage.setItem('ccos_history', JSON.stringify(history));

    } catch(e) {
      item.status = 'error';
      item.error = e.message.substring(0, 50);
    }

    window.setOutput = origSetOutput;
    imageDataArray = savedImages;
    abortController = savedAbort;

    done++;
    document.getElementById('batchProgressFill').style.width = Math.round((done / total) * 100) + '%';
    renderBatchQueue();

    if (i < batchQueue.length - 1 && !batchAbort) {
      document.getElementById('batchStatusText').textContent = `Waiting ${delay/1000}s…`;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  batchRunning = false;
  document.querySelector('#batchRunBtn span').textContent = 'Run Batch';
  document.getElementById('batchStatusText').textContent = `Batch complete — ${done} card${done !== 1 ? 's' : ''} saved to history`;
  toast('Batch done · ' + done + ' saved to history');
}

function openDiffModal() {
  if (sessionGenerations.length < 2) { toast('Need at least 2 versions to compare'); return; }
  populateDiffSelectors();
  renderDiff();
  document.getElementById('diffModal').classList.add('open');
}
function closeDiffModal() {
  document.getElementById('diffModal').classList.remove('open');
}

function populateDiffSelectors() {
  const makeOptions = (excludeVal) => sessionGenerations.map((_, i) =>
    `<option value="${i}" ${i === excludeVal ? 'selected' : ''}>Version ${i + 1}</option>`
  ).join('');
  document.getElementById('diffVersionA').innerHTML = makeOptions(Math.max(0, sessionGenerations.length - 2));
  document.getElementById('diffVersionB').innerHTML = makeOptions(sessionGenerations.length - 1);
}

function renderDiff() {
  const idxA = parseInt(document.getElementById('diffVersionA').value);
  const idxB = parseInt(document.getElementById('diffVersionB').value);
  const textA = sessionGenerations[idxA] || '';
  const textB = sessionGenerations[idxB] || '';

  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  const lcs = computeLCS(linesA, linesB);
  const diffA = [], diffB = [];
  let i = 0, j = 0, k = 0;
  while (i < linesA.length || j < linesB.length) {
    if (k < lcs.length && i < linesA.length && linesA[i] === lcs[k] && j < linesB.length && linesB[j] === lcs[k]) {
      diffA.push({ text: linesA[i], type: 'same' });
      diffB.push({ text: linesB[j], type: 'same' });
      i++; j++; k++;
    } else if (i < linesA.length && (k >= lcs.length || linesA[i] !== lcs[k])) {
      diffA.push({ text: linesA[i], type: 'removed' });
      diffB.push({ text: '', type: 'placeholder' });
      i++;
    } else {
      diffA.push({ text: '', type: 'placeholder' });
      diffB.push({ text: linesB[j], type: 'added' });
      j++;
    }
  }

  const renderLines = (lines) => lines.map(l => {
    if (l.type === 'placeholder') return `<div class="diff-line" style="min-height:1.7em;opacity:0;"></div>`;
    const escaped = l.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="diff-line ${l.type}">${escaped || '&#8203;'}</div>`;
  }).join('');

  document.getElementById('diffLinesA').innerHTML = renderLines(diffA);
  document.getElementById('diffLinesB').innerHTML = renderLines(diffB);
  document.querySelector('#diffPaneA .diff-pane-header').textContent = 'Version ' + (idxA + 1);
  document.querySelector('#diffPaneB .diff-pane-header').textContent = 'Version ' + (idxB + 1);
}

function computeLCS(a, b) {
  const maxLines = 400;
  a = a.slice(0, maxLines);
  b = b.slice(0, maxLines);
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
    else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
  }
  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { lcs.unshift(a[i-1]); i--; j--; }
    else if (dp[i-1][j] > dp[i][j-1]) i--;
    else j--;
  }
  return lcs;
}

var _origUpdateVersionUI = updateVersionUI;
updateVersionUI = function() {
  _origUpdateVersionUI();
  const diffBtn = document.getElementById('btnDiff');
  if (diffBtn) diffBtn.style.display = sessionGenerations.length >= 2 ? '' : 'none';
};

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClearBtn').classList.remove('visible');
  filterEntries();
}

var _origFilterEntries = typeof filterEntries === 'function' ? filterEntries : null;
filterEntries = function() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);

  if (!q) {
    renderEntries();
    return;
  }

  const terms = q.split(/\s+/).filter(Boolean);

  const scored = entries.map(e => {
    let score = 0;
    const name = (e.name || '').toLowerCase();
    const keys = (e.keys || []).join(' ').toLowerCase();
    const secKeys = (e.secondaryKeys || []).join(' ').toLowerCase();
    const content = (e.content || '').toLowerCase();

    if (name === q) score += 100;
    terms.forEach(t => { if (name.includes(t)) score += 30; });
    terms.forEach(t => { if (keys.includes(t)) score += 20; });
    terms.forEach(t => { if (secKeys.includes(t)) score += 15; });
    terms.forEach(t => {
      let idx = 0, count = 0;
      while ((idx = content.indexOf(t, idx)) !== -1) { count++; idx += t.length; }
      score += count * 5;
    });
    
    let snippet = '';
    if (content) {
      const firstTerm = terms[0];
      const pos = content.indexOf(firstTerm);
      if (pos !== -1) {
        const start = Math.max(0, pos - 20);
        const end = Math.min(content.length, pos + 60);
        snippet = (start > 0 ? '…' : '') + e.content.substring(start, end).replace(/\n/g, ' ') + (end < content.length ? '…' : '');
      } else {
        snippet = e.content.substring(0, 70).replace(/\n/g, ' ');
      }
    }

    return { entry: e, score, snippet };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  const list = document.getElementById('entriesList');
  const empty = document.getElementById('entriesEmpty');
  if (!scored.length) {
    list.innerHTML = '';
    if (empty) { empty.style.display = 'flex'; empty.querySelector('div').textContent = 'No matches found'; }
    return;
  }
  if (empty) empty.style.display = 'none';

  const highlightText = (text, terms) => {
    let result = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    terms.forEach(t => {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-result-highlight">$1</mark>');
    });
    return result;
  };

  list.innerHTML = scored.map(({ entry: e, score, snippet }) => {
    const isActive = e.id === (typeof activeEntryId !== 'undefined' ? activeEntryId : null);
    const hName = highlightText(e.name || 'Untitled', terms);
    const hKeys = highlightText((e.keys || []).join(', '), terms);
    const hSnippet = snippet ? highlightText(snippet, terms) : '';
    return `<div class="entry-item ${isActive ? 'active' : ''}" onclick="selectEntry('${e.id}')">
      <div class="entry-item-handle">⠿</div>
      <div class="entry-item-body">
        <div class="entry-item-name">${hName}</div>
        ${hKeys ? `<div class="entry-item-keys">${hKeys}</div>` : ''}
        ${hSnippet ? `<div class="entry-item-snippet">${hSnippet}</div>` : ''}
      </div>
      <span class="entry-item-score">${score}</span>
      <button class="entry-item-del" onclick="event.stopPropagation();deleteEntry('${e.id}')" title="Delete">×</button>
    </div>`;
  }).join('');
};

var PNG_STYLES = {
  noir:    { bg: ['#1a1614','#0a0908'], accent: '#d4af60', text: '#c8c0b4', border: '#9e7840' },
  amber:   { bg: ['#1a1408','#0f0a04'], accent: '#f0c040', text: '#e0d0a0', border: '#c09020' },
  crimson: { bg: ['#1a0810','#0f0408'], accent: '#e06080', text: '#d4b0c0', border: '#a03050' },
  arctic:  { bg: ['#0d1520','#060e18'], accent: '#60c0e0', text: '#a0c8e0', border: '#3090b0' },
  forest:  { bg: ['#0d1a0d','#060e06'], accent: '#60c090', text: '#a0c8a0', border: '#308050' },
};
var currentPngStyle = 'noir';

function setPngStyle(el) {
  document.querySelectorAll('.png-style-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  currentPngStyle = el.dataset.pngstyle;
  applyPngStyleToPreview();
}

function applyPngStyleToPreview() {
  const s = PNG_STYLES[currentPngStyle];
  const frame = document.getElementById('cardPreviewFrame');
  if (!frame) return;
  frame.style.background = `linear-gradient(160deg, ${s.bg[0]} 0%, ${s.bg[1]} 100%)`;
  frame.style.borderColor = s.border;
  frame.querySelector('.card-frame-header').style.background = `linear-gradient(90deg, ${s.border} 0%, ${s.border}66 100%)`;
  frame.querySelector('.card-frame-title').style.color = s.accent === '#d4af60' ? '#f5edd8' : '#ffffff';
  frame.querySelector('.card-frame-content').style.color = s.text;
  frame.querySelector('.card-frame-footer').style.color = s.text + '66';
}

function openPngExportModal() {
  if (!outputBuffer) { toast('Generate a card first'); return; }

  const lines = outputBuffer.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || '';
  const title = firstLine.replace(/[<{[\]}>]/g, '').replace(/^#+\s*/, '').trim().substring(0, 40);
  document.getElementById('pngCardTitle').value = title;
  document.getElementById('cardFrameTitle').textContent = title || 'Character';

  document.getElementById('cardFrameContent').textContent = outputBuffer.substring(0, 500);

  const imgWrap = document.getElementById('cardFrameImageWrap');
  if (imageDataArray.length > 0) {
    imgWrap.innerHTML = `<img src="${imageDataArray[0].dataUrl}" alt="character"><div class="card-frame-image-overlay"></div>`;
  } else {
    imgWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.2);font-size:var(--font-xs);">no image</div><div class="card-frame-image-overlay"></div>`;
  }

  document.getElementById('cardFrameDate').textContent = new Date().toLocaleDateString();
  applyPngStyleToPreview();

  document.getElementById('pngCardTitle').addEventListener('input', () => {
    document.getElementById('cardFrameTitle').textContent = document.getElementById('pngCardTitle').value || 'Character';
  });

  document.getElementById('pngModal').classList.add('open');
}
function closePngModal() {
  document.getElementById('pngModal').classList.remove('open');
}

async function downloadCardPng() {
  const title = document.getElementById('pngCardTitle').value || 'character-card';
  const s = PNG_STYLES[currentPngStyle];
  const W = 600, H = 840;
  const canvas = document.getElementById('cardPngCanvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.5, H);
  bgGrad.addColorStop(0, s.bg[0]);
  bgGrad.addColorStop(1, s.bg[1]);
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  ctx.strokeStyle = s.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 17);
  ctx.stroke();

  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, s.border);
  headerGrad.addColorStop(1, s.border + '44');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 60);
  roundRect(ctx, 0, 0, W, 60, [17, 17, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#f5edd8';
  ctx.font = 'italic 500 22px Playfair Display, Georgia, serif';
  ctx.fillText(title, 22, 38);
  ctx.fillStyle = s.text + '99';
  ctx.font = '11px DM Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('C-COS', W - 22, 38);
  ctx.textAlign = 'left';

  const imgY = 60, imgH = 240;
  if (imageDataArray.length > 0) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, imgY, W, imgH);
        ctx.clip();
        const scale = Math.max(W / img.width, imgH / img.height);
        const dx = (W - img.width * scale) / 2;
        const dy = imgY + (imgH - img.height * scale) / 2;
        ctx.filter = 'brightness(0.85) saturate(0.9)';
        ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
        ctx.filter = 'none';
        ctx.restore();
        const imgOverlay = ctx.createLinearGradient(0, imgY, 0, imgY + imgH);
        imgOverlay.addColorStop(0.6, 'transparent');
        imgOverlay.addColorStop(1, s.bg[1]);
        ctx.fillStyle = imgOverlay;
        ctx.fillRect(0, imgY, W, imgH);
        resolve();
      };
      img.src = imageDataArray[0].dataUrl;
    });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, imgY, W, imgH);
    ctx.fillStyle = s.text + '33';
    ctx.font = '13px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('no image', W / 2, imgY + imgH / 2);
    ctx.textAlign = 'left';
  }

  ctx.strokeStyle = s.border + '55';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(22, imgY + imgH + 14);
  ctx.lineTo(W - 22, imgY + imgH + 14);
  ctx.stroke();
  ctx.setLineDash([]);

  const textStartY = imgY + imgH + 30;
  const textMaxH = H - textStartY - 50;
  ctx.fillStyle = s.text;
  ctx.font = '12px DM Mono, monospace';
  const lines = wrapText(ctx, outputBuffer.replace(/<[^>]+>/g, ''), W - 44, 12);
  let ty = textStartY;
  for (const line of lines) {
    if (ty + 18 > textStartY + textMaxH) {
      ctx.fillStyle = s.text + '44';
      ctx.fillText('…', 22, ty);
      break;
    }
    ctx.fillText(line, 22, ty);
    ty += 18;
  }

  ctx.fillStyle = s.border + '66';
  ctx.fillRect(0, H - 36, W, 1);
  ctx.fillStyle = s.text + '55';
  ctx.font = '10px DM Mono, monospace';
  ctx.fillText('Character Card', 22, H - 14);
  ctx.textAlign = 'right';
  ctx.fillText('Generated by C-COS · ' + new Date().toLocaleDateString(), W - 22, H - 14);
  ctx.textAlign = 'left';

  const link = document.createElement('a');
  link.download = title.replace(/[^a-z0-9_\- ]/gi, '_').substring(0, 40) + '-card.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('PNG downloaded');
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  ctx.lineTo(x + r[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}

function wrapText(ctx, text, maxW, lineH) {
  const result = [];
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    if (!raw.trim()) { result.push(''); continue; }
    const words = raw.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) { if (current) result.push(current); current = word; }
      else current = test;
    }
    if (current) result.push(current);
  }
  return result;
}

window.addEventListener('click', e => {
  if (e.target === document.getElementById('pngModal')) closePngModal();
  if (e.target === document.getElementById('batchModal')) closeBatchModal();
  if (e.target === document.getElementById('diffModal')) closeDiffModal();
});

var PANEL_THEME_KEY = 'ccos_panel_themes';

function togglePanelTheme(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const current = panel.getAttribute('data-panel-theme');
  let next;
  if (!current) next = 'dark';
  else if (current === 'dark') next = 'light';
  else next = null;

  if (next) panel.setAttribute('data-panel-theme', next);
  else panel.removeAttribute('data-panel-theme');

  const toggleEl = panel.querySelector('.panel-theme-toggle .ptt-label');
  if (toggleEl) toggleEl.textContent = next ? next : 'panel';

  savePanelThemes();
  toast(panelId.replace('studio','').replace('Panel','').replace('codex','') + ' panel: ' + (next || 'global'));
}

function savePanelThemes() {
  const themes = {};
  document.querySelectorAll('[id$="Panel"][id^="studio"], [id$="Panel"][id^="codex"]').forEach(p => {
    const t = p.getAttribute('data-panel-theme');
    if (t) themes[p.id] = t;
  });
  localStorage.setItem(PANEL_THEME_KEY, JSON.stringify(themes));
}

function loadPanelThemes() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_THEME_KEY) || '{}');
    Object.entries(saved).forEach(([id, theme]) => {
      const panel = document.getElementById(id);
      if (panel) {
        panel.setAttribute('data-panel-theme', theme);
        const lbl = panel.querySelector('.panel-theme-toggle .ptt-label');
        if (lbl) lbl.textContent = theme;
      }
    });
  } catch(e) {}
}

loadPanelThemes();

var compareMode = false;
var compareVersionA = 0;
var compareVersionB = 1;

var _baseUpdateVersionUI = updateVersionUI;
updateVersionUI = function() {
  _baseUpdateVersionUI();
  renderVersionTabs();
  const diffBtn = document.getElementById('btnDiff');
  if (diffBtn) diffBtn.style.display = sessionGenerations.length >= 2 ? '' : 'none';
  const codexBtn = document.getElementById('btnAddToCodex');
  if (codexBtn) codexBtn.style.display = outputBuffer ? '' : 'none';
  const cmpBtn = document.getElementById('compareToggleBtn');
  if (cmpBtn) cmpBtn.classList.toggle('active', compareMode);
};

function renderVersionTabs() {
  const strip = document.getElementById('versionTabStrip');
  if (!strip) return;

  if (sessionGenerations.length < 2) {
    strip.classList.remove('visible');
    if (compareMode) exitCompareMode();
    return;
  }

  strip.classList.add('visible');

  strip.innerHTML = sessionGenerations.map((gen, i) => {
    const label = 'v' + (i + 1);
    const isActive = !compareMode && i === currentVersionIndex;
    const snippet = gen.split('\n').find(l => l.trim()) || '';
    const title = escapeHtml(snippet.replace(/[<{[\]}>]/g,'').replace(/^#+\s*/,'').trim().substring(0, 30) || label);
    return `<div class="version-tab ${isActive ? 'active' : ''}" onclick="switchToVersion(${i})" title="${title}">
      <span class="vtab-label">${label}</span>
      <button class="vtab-del" onclick="event.stopPropagation();deleteVersion(${i})" title="Remove version">×</button>
    </div>`;
  }).join('');
}

function switchToVersion(i) {
  if (compareMode) exitCompareMode();
  if (isEditing) toggleEditMode(true);
  currentVersionIndex = i;
  outputBuffer = sessionGenerations[i];
  setOutput(outputBuffer);
  updateVersionUI();
  document.getElementById('outputMeta').textContent = 'Version ' + (i + 1) + ' · ' + outputBuffer.length + ' chars';
}

function deleteVersion(i) {
  if (sessionGenerations.length <= 1) { clearOutput(); return; }
  sessionGenerations.splice(i, 1);
  currentVersionIndex = Math.min(currentVersionIndex, sessionGenerations.length - 1);
  outputBuffer = sessionGenerations[currentVersionIndex];
  setOutput(outputBuffer);
  updateVersionUI();
}

function toggleCompareMode() {
  if (compareMode) { exitCompareMode(); return; }
  if (sessionGenerations.length < 2) { toast('Generate at least 2 versions to compare'); return; }
  compareMode = true;
  compareVersionA = Math.max(0, sessionGenerations.length - 2);
  compareVersionB = sessionGenerations.length - 1;
  enterCompareMode();
}

function enterCompareMode() {
  compareMode = true;
  document.getElementById('outputArea').style.display = 'none';
  document.getElementById('editArea').style.display = 'none';
  document.getElementById('compareView').classList.add('active');
  updateCompareView();
  renderVersionTabs();
  const btn = document.getElementById('compareToggleBtn');
  if (btn) btn.classList.add('active');
}

function exitCompareMode() {
  compareMode = false;
  document.getElementById('compareView').classList.remove('active');
  document.getElementById('outputArea').style.display = '';
  if (isEditing) toggleEditMode(true);
  renderVersionTabs();
  const btn = document.getElementById('compareToggleBtn');
  if (btn) btn.classList.remove('active');
}

function updateCompareView() {
  if (!compareMode) return;
  const a = sessionGenerations[compareVersionA] || '';
  const b = sessionGenerations[compareVersionB] || '';
  document.getElementById('compareContentA').textContent = a;
  document.getElementById('compareContentB').textContent = b;
  document.getElementById('compareLabelA').textContent = 'Version ' + (compareVersionA + 1);
  document.getElementById('compareLabelB').textContent = 'Version ' + (compareVersionB + 1);
}

var PRESETS_KEY = 'ccos_override_presets';

function getPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}'); } catch(e) { return {}; }
}
function savePresetsToStorage(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
function renderPresetDropdown() {
  const sel = document.getElementById('presetSelect');
  if (!sel) return;
  const presets = getPresets();
  const keys = Object.keys(presets);
  sel.innerHTML = '<option value="">— presets —</option>' +
    keys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
}

function togglePresetSaveRow() {
  const row = document.getElementById('presetSaveRow');
  if (!row) return;
  const isVisible = row.classList.toggle('visible');
  if (isVisible) {
    const inp = document.getElementById('presetNameInput');
    inp.value = '';
    inp.focus();
  }
}

function savePreset() {
  const nameInp = document.getElementById('presetNameInput');
  const name = nameInp.value.trim();
  if (!name) { toast('Enter a preset name'); nameInp.focus(); return; }
  const override = document.getElementById('overrideInput').value;
  if (!override.trim()) { toast('Override textarea is empty'); return; }
  const presets = getPresets();
  presets[name] = override;
  savePresetsToStorage(presets);
  renderPresetDropdown();
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = name;
  togglePresetSaveRow();
  toast('Preset "' + name + '" saved');
}

function loadPreset(name) {
  if (!name) return;
  const presets = getPresets();
  if (presets[name] !== undefined) {
    document.getElementById('overrideInput').value = presets[name];
    studioQueueDraftSave();
    toast('Preset loaded: ' + name);
  }
}

function deleteSelectedPreset() {
  const sel = document.getElementById('presetSelect');
  const name = sel ? sel.value : '';
  if (!name) { toast('Select a preset first'); return; }
  const presets = getPresets();
  delete presets[name];
  savePresetsToStorage(presets);
  renderPresetDropdown();
  toast('Preset "' + name + '" deleted');
}

renderPresetDropdown();

function addToCodex() {
  if (!outputBuffer) { toast('Generate a card first'); return; }

  const lines = outputBuffer.split('\n').map(l => l.trim()).filter(Boolean);
  let charName = '';
  for (const line of lines) {
    const cleaned = line.replace(/[<{[\]}>]/g, '').replace(/^#+\s*/, '').replace(/^name[:\s]*/i, '').trim();
    if (cleaned.length > 1 && cleaned.length < 60) { charName = cleaned; break; }
  }
  if (!charName) charName = (imageDataArray[0]?.name || 'Character').replace(/\.[^.]+$/, '');

  const keyTraits = [];
  const traitPatterns = [/personality[:\s]+(.+)/i, /traits?[:\s]+(.+)/i, /appearance[:\s]+(.+)/i, /occupation[:\s]+(.+)/i, /role[:\s]+(.+)/i];
  for (const line of lines) {
    for (const pat of traitPatterns) {
      const m = line.match(pat);
      if (m) {
        const val = m[1].replace(/[<{[\]}>]/g,'').trim().toLowerCase().split(/[\s,;]+/).filter(Boolean);
        val.forEach(v => { if (v.length > 2 && v.length < 20 && !keyTraits.includes(v)) keyTraits.push(v); });
        break;
      }
    }
    if (keyTraits.length >= 6) break;
  }
  const nameKey = charName.toLowerCase().split(/\s+/)[0];
  if (nameKey && !keyTraits.includes(nameKey)) keyTraits.unshift(nameKey);

  switchMode('codex');

  setTimeout(() => {
    const entry = typeof newEntry === 'function' ? newEntry({ name: charName, keys: keyTraits, content: outputBuffer, order: entries.length }) : null;
    if (!entry) { toast('Could not create Codex entry'); return; }
    entries.unshift(entry);
    saveEntries();
    renderEntries();
    selectEntry(entry.id);
    toast('✦ Added "' + charName + '" to Codex');
  }, 80);
}

function showPasteFlash(success) {
  const flash = document.getElementById('pasteFlash');
  if (!flash) return;
  flash.textContent = success ? '✓ Image pasted!' : '⚠ No image in clipboard';
  flash.classList.add('show');
  setTimeout(() => flash.classList.remove('show'), 1200);
}

document.addEventListener('paste', async function(e) {
  if (currentMode !== 'studio') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;

  let imageFile = null;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      imageFile = item.getAsFile();
      break;
    }
  }

  if (!imageFile) {
    return;
  }

  e.preventDefault();
  showPasteFlash(true);
  loadImageFiles([imageFile]);
});

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
  }
});
