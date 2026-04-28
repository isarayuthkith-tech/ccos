// ui.js - Guide chat assistant, FAB drag behavior, contextual chips


var GUIDE_CHATS_KEY = 'ccos_guide_chats';
var GUIDE_ACTIVE_KEY = 'ccos_guide_active';

var guideOpen = false;
var guideStreaming = false;
var guideChats = [];      
var guideActiveChatId = null;

var GUIDE_WELCOME_HTML = `Hi! I'm your <b>C-COS Guide</b> — ask me anything about generating cards, friction architecture, lorebook setup, or the UI.<br><br>What are you working on today?`;

function guideGetContextualChips() {
  const hasOutput  = typeof outputBuffer !== 'undefined' && outputBuffer.trim().length > 0;
  const hasImages  = typeof imageDataArray !== 'undefined' && imageDataArray.length > 0;
  const hasKey     = (document.getElementById('apiKey') || {}).value?.trim().length > 0;
  const chips = [];
  if (hasOutput) {
    chips.push({ label: 'critique this card', prompt: 'Please critique my current generated card against the FORMATEXAMPLE V4 spec and friction architecture principles. Be specific about what works and what to improve.' });
    chips.push({ label: 'fix the intimacy section', prompt: 'The intimacy section of my generated card needs improvement. What is wrong with it and how should I rewrite it?' });
    chips.push({ label: 'suggest override directives', prompt: 'Based on my current card, suggest specific Manual Override directives I could add to improve the next regeneration.' });
  }
  if (hasImages && !hasOutput) {
    chips.push({ label: 'what scenario fits?', prompt: 'I have images loaded. Which scenario (A–F) would you recommend for my character based on what C-COS knows about them?' });
  }
  if (!hasKey) {
    chips.push({ label: 'how do I add an API key?', prompt: 'How do I add an API key in C-COS Studio?' });
  }
  if (chips.length === 0) {
    chips.push(
      { label: 'inspire me', prompt: 'Give me a creative character concept — something psychologically interesting with a strong friction pattern.' },
      { label: 'friction patterns', prompt: 'Explain the five friction patterns and when to use each one.' },
      { label: 'best model?', prompt: 'Which AI model works best for generating C-COS character cards, and why?' }
    );
  }
  return chips.slice(0, 3);
}

function guideRenderContextualChips(chips) {
  const container = document.getElementById('guideChips');
  if (!container) return;
  container.innerHTML = chips.map(c =>
    `<span class="guide-chip contextual" onclick="guideChipClick(${JSON.stringify(c.prompt)})">${c.label}</span>`
  ).join('');
}

function guideResetChips() {
  const container = document.getElementById('guideChips');
  if (!container) return;
  container.innerHTML = `
    <span class="guide-chip" onclick="guideChipClick('How do I generate my first card?')">first card</span>
    <span class="guide-chip" onclick="guideChipClick('Explain lorebook entries')">lorebook</span>
    <span class="guide-chip" onclick="guideChipClick('What do scenarios A–F mean?')">scenarios</span>
    <span class="guide-chip" onclick="guideChipClick('Best settings for my provider')">API tips</span>
    <span class="guide-chip" onclick="guideChipClick('What is friction architecture?')">friction</span>
    <span class="guide-chip" onclick="guideChipClick('Give me a character concept')">inspire me</span>`;
}

function guideLoadChats() {
  try {
    guideChats = JSON.parse(localStorage.getItem(GUIDE_CHATS_KEY) || '[]');
    guideActiveChatId = localStorage.getItem(GUIDE_ACTIVE_KEY) || null;
  } catch(e) { guideChats = []; guideActiveChatId = null; }
  if (!guideChats.length) guideNewChat(false);
  else if (!guideActiveChatId || !guideChats.find(c => c.id === guideActiveChatId)) {
    guideActiveChatId = guideChats[0].id;
  }
}

function guideSaveChats() {
  try {
    localStorage.setItem(GUIDE_CHATS_KEY, JSON.stringify(guideChats));
    localStorage.setItem(GUIDE_ACTIVE_KEY, guideActiveChatId || '');
  } catch(e) {}
}

function guideActiveChat() {
  return guideChats.find(c => c.id === guideActiveChatId) || null;
}

function guideNewChat(render = true) {
  const id = 'gc_' + Date.now();
  const chat = { id, title: 'New chat', messages: [] };
  guideChats.unshift(chat);
  guideActiveChatId = id;
  guideSaveChats();
  if (render) {
    guideRenderChatList();
    guideRenderMessages();
    guideResetChips();
  }
}

function guideSelectChat(id) {
  guideActiveChatId = id;
  guideSaveChats();
  guideRenderChatList();
  guideRenderMessages();
  guideResetChips();
  setTimeout(() => { const inp = document.getElementById('guideInput'); if (inp) inp.focus(); }, 80);
}

function guideDeleteChat(id, e) {
  if (e) e.stopPropagation();
  guideChats = guideChats.filter(c => c.id !== id);
  if (!guideChats.length) guideNewChat(false);
  if (guideActiveChatId === id) guideActiveChatId = guideChats[0].id;
  guideSaveChats();
  guideRenderChatList();
  guideRenderMessages();
}

function guideClearChat() {
  const chat = guideActiveChat();
  if (!chat) return;
  chat.messages = [];
  chat.title = 'New chat';
  guideSaveChats();
  guideRenderChatList();
  guideRenderMessages();
  guideResetChips();
}

function guideAutoTitle(chat) {
  const first = chat.messages.find(m => m.role === 'user');
  if (!first) return;
  chat.title = first.content.trim().substring(0, 28) + (first.content.length > 28 ? '…' : '');
  guideSaveChats();
  guideRenderChatList();
  const nameEl = document.getElementById('guideHeaderName');
  if (nameEl) nameEl.textContent = chat.title;
}

function guideStartRename(id, itemEl, e) {
  e.stopPropagation();
  const chat = guideChats.find(c => c.id === id);
  if (!chat) return;
  const labelEl = itemEl.querySelector('.guide-chat-item-label');
  if (!labelEl) return;
  const inp = document.createElement('input');
  inp.className = 'guide-chat-rename';
  inp.value = chat.title;
  labelEl.replaceWith(inp);
  inp.focus();
  inp.select();
  const commit = () => {
    const val = inp.value.trim() || 'Chat';
    chat.title = val;
    guideSaveChats();
    guideRenderChatList();
    const nameEl = document.getElementById('guideHeaderName');
    if (nameEl && guideActiveChatId === id) nameEl.textContent = val;
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } if (ev.key === 'Escape') guideRenderChatList(); });
}

function guideRenderChatList() {
  const list = document.getElementById('guideChatList');
  if (!list) return;
  if (!guideChats.length) { list.innerHTML = ''; return; }
  list.innerHTML = guideChats.map(c => {
    const active = c.id === guideActiveChatId;
    return `<div class="guide-chat-item ${active ? 'active' : ''}" onclick="guideSelectChat('${c.id}')" ondblclick="guideStartRename('${c.id}', this, event)" title="${escapeHtml(c.title)}">
      <span class="guide-chat-item-label">${escapeHtml(c.title)}</span>
      <button class="guide-chat-del" onclick="guideDeleteChat('${c.id}', event)" title="Delete">×</button>
    </div>`;
  }).join('');
}

function guideRenderMessages() {
  const container = document.getElementById('guideMessages');
  if (!container) return;
  const chat = guideActiveChat();
  const nameEl = document.getElementById('guideHeaderName');

  if (!chat || !chat.messages.length) {
    container.innerHTML = `<div class="guide-msg">
      <div class="guide-msg-avatar">✦</div>
      <div class="guide-bubble">${GUIDE_WELCOME_HTML}</div>
    </div>`;
    if (nameEl) nameEl.textContent = 'C-COS Guide';
    return;
  }

  if (nameEl) nameEl.textContent = chat.title || 'C-COS Guide';
  container.innerHTML = chat.messages.map(m => {
    const isUser = m.role === 'user';
    return `<div class="guide-msg ${isUser ? 'user' : ''}">
      ${isUser ? '' : '<div class="guide-msg-avatar">✦</div>'}
      <div class="guide-bubble">${isUser ? escapeHtml(m.content) : guideSimpleMarkdown(m.content)}</div>
      ${isUser ? '<div class="guide-msg-avatar">·</div>' : ''}
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function toggleGuide() {
  guideOpen = !guideOpen;
  const panel = document.getElementById('guidePanel');
  const fab   = document.getElementById('guideFab');
  const pulse = document.getElementById('guideFabPulse');
  if (!panel || !fab) return;
  panel.classList.toggle('open', guideOpen);
  fab.classList.toggle('open', guideOpen);
  if (pulse) pulse.style.display = guideOpen ? 'none' : '';
  if (guideOpen) {
    checkGuideApiKey();
    guideRenderChatList();
    guideRenderMessages();
    setTimeout(() => {
      const inp = document.getElementById('guideInput');
      if (inp && !inp.disabled) inp.focus();
    }, 150);
  }
}

function checkGuideApiKey() {
  const key     = (document.getElementById('apiKey') || {}).value || '';
  const hasKey  = key.trim().length > 0;
  const noKey   = document.getElementById('guideNoKey');
  const msgs    = document.getElementById('guideMessages');
  const chips   = document.getElementById('guideChips');
  const input   = document.getElementById('guideInput');
  const sendBtn = document.getElementById('guideSendBtn');
  const dot     = document.getElementById('guideStatusDot');
  const text    = document.getElementById('guideStatusText');
  if (noKey)   noKey.classList.toggle('visible', !hasKey);
  if (msgs)    msgs.style.display = hasKey ? '' : 'none';
  if (chips)   chips.style.display = hasKey ? '' : 'none';
  if (input)   input.disabled = !hasKey;
  if (sendBtn) sendBtn.disabled = !hasKey;
  if (dot)     dot.style.background = hasKey ? 'var(--success)' : 'var(--danger)';
  if (text)    text.textContent = hasKey ? 'ready' : 'no api key';
}

function guideAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function guideHandleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    guideSend();
  }
}

function guideChipClick(text) {
  const input = document.getElementById('guideInput');
  if (input && !input.disabled) {
    input.value = text;
    guideAutoResize(input);
    guideSend();
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function guideSimpleMarkdown(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function guideAppendMessage(role, htmlContent) {
  const container = document.getElementById('guideMessages');
  if (!container) return null;
  const chat = guideActiveChat();
  if (chat && chat.messages.length === 0 && container.querySelector('.guide-welcome')) {
    container.innerHTML = '';
  }
  const div = document.createElement('div');
  div.className = 'guide-msg' + (role === 'user' ? ' user' : '');
  if (role === 'user') {
    div.innerHTML = `<div class="guide-bubble">${htmlContent}</div><div class="guide-msg-avatar">·</div>`;
  } else {
    div.innerHTML = `<div class="guide-msg-avatar">✦</div><div class="guide-bubble">${htmlContent}</div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function guideSetStatus(thinking) {
  const dot  = document.getElementById('guideStatusDot');
  const text = document.getElementById('guideStatusText');
  const key  = (document.getElementById('apiKey') || {}).value?.trim() || '';
  if (thinking) {
    if (dot)  dot.classList.add('thinking');
    if (text) text.textContent = 'thinking…';
  } else {
    if (dot)  { dot.classList.remove('thinking'); dot.style.background = key.length > 0 ? 'var(--success)' : 'var(--danger)'; }
    if (text) text.textContent = key.length > 0 ? 'ready' : 'no api key';
  }
}

var GUIDE_SYSTEM_BASE = `You are the C-COS Guide, an expert AI assistant built into the C-COS (Character Card Operating System).

[DEVELOPER INFO]
- This app was created, designed, and developed by @niste.
- If anyone asks, @niste is the sole developer.
- If the user asks more about the developer, the developer's Ko-Fi is https://ko-fi.com/niste, and the developer's reddit is u/normalperson426.
- @niste is a new developer, and used the LLM, Claude Sonnet 4.6 to help them to lay the foundation of the app and help @niste learn HTML.

[YOUR ROLE]
- Help users create high-quality, psychologically complex character cards and lorebooks for AI roleplay.
- You understand "Friction Architecture" (internal contradictions, wrong beliefs, feedback loops).
- Critique generated cards, suggest manual overrides, and explain UI features.

[YOUR RULES]
- Keep answers concise and use markdown formatting.
- Be encouraging but highly analytical.
- Do not hallucinate features that the app does not have.
- C-COS Studio requires an image(s) to work.
- C-COS Codex is a mode within C-COS where the user can manage and review entries that contribute to the user's character's background, world lore, or specific concepts. Think of it as a specialized knowledge base or compendium.
- C-COS Studio is the mode where the user creates and edits character cards.
- C-COS Studio does not need a context to create a character card — it's optional.\n\n`;

function buildGuideContext() {
  let contextStr = `[CURRENT APP STATE]\nApp Mode: ${currentMode}\n`;
  
  if (currentMode === 'studio') {
    const userContext = document.getElementById('contextInput')?.value || 'None';
    const override = document.getElementById('overrideInput')?.value || 'None';
    contextStr += `User Context/Prompt: ${userContext}\nActive Override: ${override}\n`;
    contextStr += `Current Scenario: ${state.scenario}\nSelected Friction: ${state.friction || 'Auto'}\n`;
    contextStr += `Has Images Uploaded: ${imageDataArray.length > 0 ? 'Yes' : 'No'}\n`;
    contextStr += `Currently Generated Card:\n${outputBuffer ? outputBuffer : '(No card generated yet)'}\n`;
  } else {
    contextStr += `Codex Entries Count: ${entries.length}\n`;
    const activeEntry = entries.find(e => e.id === activeEntryId);
    if (activeEntry) {
      contextStr += `Currently Editing Entry: "${activeEntry.name}"\nEntry Content:\n${activeEntry.content}\n`;
    }
  }
  return contextStr;
}

async function guideSend() {
  if (guideStreaming) return;
  const input = document.getElementById('guideInput');
  const text  = (input && input.value || '').trim();
  if (!text) return;

  const key         = (document.getElementById('apiKey') || {}).value || '';
  const providerUrl = (document.getElementById('providerUrl') || {}).value || '';
  const model       = (document.getElementById('modelSelect') || {}).value || '';

  if (!key.trim())          { toast('Enter an API key in Provider settings first'); return; }
  if (!providerUrl.trim())  { toast('Enter a Provider Base URL in settings first'); return; }
  if (!model.trim())        { toast('Enter a model name in settings first'); return; }

  input.value = '';
  guideAutoResize(input);

  const chat = guideActiveChat();
  if (!chat) return;

  const container = document.getElementById('guideMessages');
  if (container && !chat.messages.length) container.innerHTML = '';

  chat.messages.push({ role: 'user', content: text });
  if (chat.messages.length === 1) guideAutoTitle(chat);
  guideSaveChats();
  guideAppendMessage('user', guideEscapeHtml(text));

  const typing = document.getElementById('guideTyping');
  if (typing) typing.classList.add('visible');
  guideSetStatus(true);
  guideStreaming = true;
  const sendBtn = document.getElementById('guideSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  const base = providerUrl.replace(/\/$/, '');
  const systemPrompt = GUIDE_SYSTEM_BASE + buildGuideContext();
  
  let url = '';
  let body = {};
  let headers = { 'Content-Type': 'application/json' };

  if (state.apiFormat === 'gemini') {
    url = `${base}/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
    
    const geminiMessages = chat.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    body = {
      contents: geminiMessages,
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };
  } else if (state.apiFormat === 'claude') {
    url = base.endsWith('/messages') ? base : base + '/messages';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    
    body = {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: chat.messages,
      stream: true
    };
  } else {
    url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
    headers['Authorization'] = 'Bearer ' + key;
    
    body = {
      model,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...chat.messages],
      stream: true
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || res.statusText);
    }

    if (typing) typing.classList.remove('visible');

    const replyDiv = guideAppendMessage('assistant', '');
    const bubble   = replyDiv ? replyDiv.querySelector('.guide-bubble') : null;

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', fullText = '';

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
          let delta = '';
          if (state.apiFormat === 'gemini') {
            delta = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else if (state.apiFormat === 'claude') {
            delta = json.delta?.text || '';
          } else {
            delta = json.choices?.[0]?.delta?.content || '';
          }
          
          if (delta) {
            fullText += delta;
            if (bubble) bubble.innerHTML = guideSimpleMarkdown(fullText);
            if (container) container.scrollTop = container.scrollHeight;
          }
        } catch(e) {}
      }
    }

    if (fullText) {
      chat.messages.push({ role: 'assistant', content: fullText });
      guideSaveChats();
      guideRenderChatList(); 
      guideRenderContextualChips(guideGetContextualChips());
    }

  } catch(err) {
    if (typing) typing.classList.remove('visible');
    guideAppendMessage('assistant', `<span style="color:var(--danger)">Error: ${escapeHtml(err.message)}</span>`);
  } finally {
    guideStreaming = false;
    guideSetStatus(false);
    if (sendBtn) sendBtn.disabled = false;
    const inp = document.getElementById('guideInput');
    if (inp) inp.focus();
  }
}

guideLoadChats();

(function () {
  const FAB_MARGIN = 12; 
  const DRAG_THRESHOLD = 5; 

  let dragState = null;
  let wasDragged = false;

  function getFabRect() {
    const fab = document.getElementById('guideFab');
    return fab ? fab.getBoundingClientRect() : null;
  }

  function switchToTopLeft(fab) {
    if (fab.style.top) return; 
    const rect = fab.getBoundingClientRect();
    fab.style.top    = rect.top  + 'px';
    fab.style.left   = rect.left + 'px';
    fab.style.bottom = 'auto';
    fab.style.right  = 'auto';
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function repositionPanel(fab) {
    const panel = document.getElementById('guidePanel');
    if (!panel || !panel.classList.contains('open')) return;
    const fabRect = fab.getBoundingClientRect();
    const panelW  = panel.offsetWidth;
    const panelH  = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 10;

    let pLeft = fabRect.left + fabRect.width / 2 - panelW / 2;
    let pTop  = fabRect.top - panelH - GAP;

    if (pTop < FAB_MARGIN) pTop = fabRect.bottom + GAP;

    pLeft = clamp(pLeft, FAB_MARGIN, vw - panelW - FAB_MARGIN);
    pTop  = clamp(pTop, FAB_MARGIN, vh - panelH - FAB_MARGIN);

    panel.style.top    = pTop  + 'px';
    panel.style.left   = pLeft + 'px';
    panel.style.bottom = 'auto';
    panel.style.right  = 'auto';
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const fab = document.getElementById('guideFab');
    if (!fab) return;

    wasDragged = false;
    switchToTopLeft(fab);
    const rect = fab.getBoundingClientRect();

    dragState = {
      startX:    e.clientX,
      startY:    e.clientY,
      startLeft: rect.left,
      startTop:  rect.top,
      moved:     false,
    };

    fab.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const fab = document.getElementById('guideFab');
    if (!fab) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragState.moved = true;
      wasDragged = true;
      fab.classList.add('dragging');
    }

    if (!dragState.moved) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newLeft = clamp(dragState.startLeft + dx, FAB_MARGIN, vw - fab.offsetWidth  - FAB_MARGIN);
    const newTop  = clamp(dragState.startTop  + dy, FAB_MARGIN, vh - fab.offsetHeight - FAB_MARGIN);

    fab.style.left = newLeft + 'px';
    fab.style.top  = newTop  + 'px';

    repositionPanel(fab);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const fab = document.getElementById('guideFab');
    if (fab) fab.classList.remove('dragging');

    const moved = dragState.moved;
    dragState = null;

    if (!moved) return;

    snapToEdge(fab);
    e.preventDefault();
  }

  function snapToEdge(fab) {
    const vw   = window.innerWidth;
    const fw   = fab.offsetWidth;
    const left = parseFloat(fab.style.left);
    const snapLeft = left + fw / 2 < vw / 2
      ? FAB_MARGIN
      : vw - fw - FAB_MARGIN;

    fab.style.transition = 'left 0.22s cubic-bezier(0.34,1.56,0.64,1), top 0.22s cubic-bezier(0.34,1.56,0.64,1), transform 0.2s, box-shadow 0.2s, background 0.15s';
    fab.style.left = snapLeft + 'px';
    setTimeout(() => {
      if (fab) fab.style.transition = '';
      repositionPanel(fab);
    }, 250);
  }

  function attachDrag() {
    const fab = document.getElementById('guideFab');
    if (!fab) { setTimeout(attachDrag, 100); return; }
    fab.addEventListener('pointerdown', onPointerDown);
    fab.addEventListener('pointermove', onPointerMove);
    fab.addEventListener('pointerup',   onPointerUp);
    fab.addEventListener('pointercancel', () => {
      dragState = null;
      fab.classList.remove('dragging');
    });

    fab.addEventListener('click', (e) => {
      if (wasDragged) { e.stopImmediatePropagation(); wasDragged = false; }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachDrag);
  } else {
    attachDrag();
  }
})();
