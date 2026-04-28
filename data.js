// data.js - Constants, prompts, models, baseline data, and runtime state


var GENERATION_STEPS = [
  { id: 'analyze', label: 'Image Analysis' },
  { id: 'contradiction', label: 'Contradiction Discovery' },
  { id: 'psychology', label: 'Psychology Mapping' },
  { id: 'generate', label: 'Section Generation' },
  { id: 'gates', label: 'Quality Gates' },
  { id: 'polish', label: 'Final Polish' }
];

var currentGenerationStep = -1;
var qualityGateResults = {};

function setGenerationStep(stepIndex) {
  currentGenerationStep = stepIndex;
  const progressEl = document.getElementById('generationProgress');
  const stepsEl = document.getElementById('progressSteps');
  
  if (stepIndex < 0) {
    progressEl.classList.remove('visible');
    return;
  }
  
  progressEl.classList.add('visible');
  stepsEl.innerHTML = GENERATION_STEPS.map((step, i) => {
    let dotClass = '';
    if (i < stepIndex) dotClass = 'done';
    else if (i === stepIndex) dotClass = 'active';
    
    return `
      <div class="progress-step">
        <div class="progress-step-dot ${dotClass}"></div>
        <span class="progress-step-label">${step.label}</span>
      </div>
      ${i < GENERATION_STEPS.length - 1 ? '<div class="progress-connector"></div>' : ''}
    `;
  }).join('');
}

var QUALITY_GATES = [
  { id: 'banned_words', label: 'Banned Words Check', description: 'No Tier 1 banned words' },
  { id: 'dialogue_count', label: 'Dialogue Examples', description: '6 exchanges present' },
  { id: 'sections_complete', label: 'Section Completeness', description: 'All required sections present' },
  { id: 'contradiction_present', label: 'Contradiction Engine', description: 'Core contradiction established' },
  { id: 'voice_consistency', label: 'Voice Consistency', description: 'Dialogue voice matches fingerprint' }
];

function resetQualityGates() {
  qualityGateResults = {};
  const panel = document.getElementById('qualityGatesPanel');
  panel.classList.remove('visible');
  updateQualityGatesDisplay();
}

function setQualityGate(gateId, status, message = '') {
  qualityGateResults[gateId] = { status, message };
  updateQualityGatesDisplay();
}

function updateQualityGatesDisplay() {
  const panel = document.getElementById('qualityGatesPanel');
  const list = document.getElementById('qualityGatesList');
  const summary = document.getElementById('gatesSummary');
  
  if (Object.keys(qualityGateResults).length === 0) {
    panel.classList.remove('visible');
    return;
  }
  
  panel.classList.add('visible');
  
  const passed = Object.values(qualityGateResults).filter(r => r.status === 'pass').length;
  const failed = Object.values(qualityGateResults).filter(r => r.status === 'fail').length;
  const pending = Object.values(qualityGateResults).filter(r => r.status === 'pending').length;
  
  summary.innerHTML = `<span style="color:${failed > 0 ? 'var(--danger)' : pending > 0 ? 'var(--accent)' : 'var(--success)'}">${passed}/${QUALITY_GATES.length} passed</span>`;
  
  list.innerHTML = QUALITY_GATES.map(gate => {
    const result = qualityGateResults[gate.id];
    if (!result) {
      return `<div class="quality-gate-item"><div class="quality-gate-status"></div><span>${escapeHtml(gate.label)}</span></div>`;
    }
    return `<div class="quality-gate-item"><div class="quality-gate-status ${result.status}"></div><span>${escapeHtml(gate.label)}${result.message ? ': ' + escapeHtml(result.message) : ''}</span></div>`;
  }).join('');
}

function checkQualityGates(text) {
  const bannedWords = ['gaze', 'orbs', 'smirk', 'chiseled', 'lithe', 'porcelain', 'sculpted', 'ethereal', 'striking', 'bountiful', 'bosom', 'somehow', 'almost', 'nearly', 'just', 'a little', 'slightly'];
  const foundBanned = bannedWords.filter(w => text.toLowerCase().includes(w.toLowerCase()));
  if (foundBanned.length > 0) {
    setQualityGate('banned_words', 'fail', `Found: ${foundBanned.slice(0, 3).join(', ')}${foundBanned.length > 3 ? '...' : ''}`);
  } else {
    setQualityGate('banned_words', 'pass');
  }
  
  const dialogueMatches = text.match(/Exchange \d| Dialogue \d/gi);
  const dialogueCount = dialogueMatches ? dialogueMatches.length : 0;
  if (dialogueCount >= 6) {
    setQualityGate('dialogue_count', 'pass');
  } else {
    setQualityGate('dialogue_count', 'fail', `Found ${dialogueCount}/6 exchanges`);
  }
  
  const requiredSections = ['BASIC INFO', 'APPEARANCE', 'SPEECH & HABITS', 'PSYCHOLOGY & PERSONALITY', 'BACKSTORY & WORLD', 'INTIMACY', 'DIALOGUE EXAMPLES'];
  const missing = requiredSections.filter(s => !text.includes(s));
  if (missing.length === 0) {
    setQualityGate('sections_complete', 'pass');
  } else {
    setQualityGate('sections_complete', 'fail', `Missing: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '...' : ''}`);
  }
}

var currentModelCardReport = null;

function validateAgainstModelCard(generatedText) {
  if (!generatedText || generatedText.length < 100) return null;
  
  const report = {
    overallScore: 0,
    sections: { passed: [], failed: [], totalWeight: 0 },
    qualityChecks: { passed: [], failed: [], totalWeight: 0 },
    bannedConstructions: [],
    suggestions: []
  };
  
  const text = generatedText.toLowerCase();
  
  // Check each required section
  MODEL_CARD_BASELINE.requiredSections.forEach(section => {
    const found = section.indicators.some(indicator => 
      text.includes(indicator.toLowerCase())
    );
    report.sections.totalWeight += section.weight;
    if (found) {
      report.sections.passed.push({ name: section.name, weight: section.weight });
    } else {
      report.sections.failed.push({ 
        name: section.name, 
        weight: section.weight,
        suggestion: IMPROVEMENT_SUGGESTIONS.missingSection(section.name)
      });
    }
  });
  
  // Check friction architecture
  const hasFrictionPattern = MODEL_CARD_BASELINE.qualityMarkers.frictionArchitecture.patterns.some(
    p => text.includes(p.toLowerCase())
  );
  const hasFrictionLoop = MODEL_CARD_BASELINE.qualityMarkers.frictionArchitecture.loops.some(
    l => text.includes(l.toLowerCase().replace('/', ' '))
  );
  if (hasFrictionPattern && hasFrictionLoop) {
    report.qualityChecks.passed.push({ name: 'Friction Architecture', weight: 6 });
  } else {
    report.qualityChecks.failed.push({ 
      name: 'Friction Architecture', 
      weight: 6,
      suggestion: IMPROVEMENT_SUGGESTIONS.missingFrictionArchitecture
    });
  }
  report.qualityChecks.totalWeight += 6;
  
  // Check voice consistency markers
  const voiceChecks = [
    { name: 'Sentence Rhythm', test: /sentence rhythm/i },
    { name: 'Vocabulary Register', test: /vocabulary register/i },
    { name: 'Deflection Style', test: /deflection style/i },
    { name: 'Physical Tell', test: /physical tell/i }
  ];
  let voiceScore = 0;
  voiceChecks.forEach(check => {
    if (check.test.test(generatedText)) voiceScore++;
  });
  if (voiceScore >= 4) {
    report.qualityChecks.passed.push({ name: 'Voice Fingerprint', weight: 4 });
  } else {
    report.qualityChecks.failed.push({ 
      name: 'Voice Fingerprint', 
      weight: 4,
      suggestion: IMPROVEMENT_SUGGESTIONS.missingVoiceFingerprint
    });
  }
  report.qualityChecks.totalWeight += 4;
  
  // Check formatting
  const hasTimestamp = MODEL_CARD_BASELINE.qualityMarkers.formatting.hasTimestampHeader.test(generatedText);
  if (hasTimestamp) {
    report.qualityChecks.passed.push({ name: 'Timestamp Header', weight: 2 });
  } else {
    report.qualityChecks.failed.push({ 
      name: 'Timestamp Header', 
      weight: 2,
      suggestion: IMPROVEMENT_SUGGESTIONS.missingTimestampHeader
    });
  }
  report.qualityChecks.totalWeight += 2;
  
  // Check dialogue count
  const dialogueMatches = generatedText.match(/Exchange \d|Dialogue \d/gi);
  const dialogueCount = dialogueMatches ? dialogueMatches.length : 0;
  if (dialogueCount >= 6) {
    report.qualityChecks.passed.push({ name: 'Dialogue Count', weight: 3 });
  } else {
    report.qualityChecks.failed.push({ 
      name: 'Dialogue Count', 
      weight: 3,
      suggestion: IMPROVEMENT_SUGGESTIONS.missingDialogueCount(dialogueCount)
    });
  }
  report.qualityChecks.totalWeight += 3;
  
  // Check backstory anchors
  const anchorMatches = generatedText.match(/Anchor \d/gi);
  const anchorCount = anchorMatches ? anchorMatches.length : 0;
  if (anchorCount >= 4) {
    report.qualityChecks.passed.push({ name: 'Backstory Anchors', weight: 3 });
  } else {
    report.qualityChecks.failed.push({ 
      name: 'Backstory Anchors', 
      weight: 3,
      suggestion: IMPROVEMENT_SUGGESTIONS.missingAnchors(anchorCount)
    });
  }
  report.qualityChecks.totalWeight += 3;
  
  // Check banned constructions
  MODEL_CARD_BASELINE.bannedConstructions.forEach(ban => {
    const matches = generatedText.match(ban.pattern);
    if (matches) {
      matches.forEach(match => {
        report.bannedConstructions.push({
          word: match,
          severity: ban.severity,
          suggestion: ban.suggestion
        });
      });
    }
  });
  
  // Calculate score
  const sectionScore = report.sections.passed.reduce((sum, s) => sum + s.weight, 0) / report.sections.totalWeight * 50;
  const qualityScore = report.qualityChecks.passed.reduce((sum, q) => sum + q.weight, 0) / report.qualityChecks.totalWeight * 40;
  const banPenalty = report.bannedConstructions.filter(b => b.severity === 'error').length * 3;
  report.overallScore = Math.max(0, Math.round(sectionScore + qualityScore - banPenalty));
  
  return report;
}

function displayModelCardReport(report) {
  if (!report) return;
  currentModelCardReport = report;
  
  const panel = document.getElementById('modelCardReport');
  const scoreEl = document.getElementById('modelCardScore');
  const comparisonEl = document.getElementById('modelCardComparison');
  
  panel.classList.add('visible');
  
  // Set score with color coding
  scoreEl.textContent = report.overallScore + '/100';
  scoreEl.className = 'model-card-score ' + (report.overallScore >= 71 ? 'high' : report.overallScore >= 41 ? 'medium' : 'low');
  
  // Build comparison HTML
  let html = '';
  
  // Sections category
  const sectionPassCount = report.sections.passed.length;
  const sectionTotal = MODEL_CARD_BASELINE.requiredSections.length;
  const sectionStatus = sectionPassCount === sectionTotal ? 'pass' : sectionPassCount > sectionTotal / 2 ? 'warn' : 'fail';
  html += buildCategoryHTML('Sections', sectionStatus, `${sectionPassCount}/${sectionTotal}`, report.sections.failed.map(s => ({
    icon: 'fail',
    text: s.name,
    suggestion: s.suggestion
  })));
  
  // Quality checks category
  const qualityPassCount = report.qualityChecks.passed.length;
  const qualityTotal = report.qualityChecks.passed.length + report.qualityChecks.failed.length;
  const qualityStatus = qualityPassCount === qualityTotal ? 'pass' : qualityPassCount > qualityTotal / 2 ? 'warn' : 'fail';
  html += buildCategoryHTML('Quality Markers', qualityStatus, `${qualityPassCount}/${qualityTotal}`, report.qualityChecks.failed.map(q => ({
    icon: 'fail',
    text: q.name,
    suggestion: q.suggestion
  })));
  
  // Banned constructions category (if any)
  if (report.bannedConstructions.length > 0) {
    const errorCount = report.bannedConstructions.filter(b => b.severity === 'error').length;
    const banStatus = errorCount === 0 ? 'warn' : 'fail';
    html += buildCategoryHTML('Banned Constructions', banStatus, `${report.bannedConstructions.length} found`, report.bannedConstructions.slice(0, 5).map(b => ({
      icon: b.severity === 'error' ? 'fail' : 'warn',
      text: `'${b.word}'`,
      suggestion: b.suggestion
    })));
  }
  
  comparisonEl.innerHTML = html;
}

function buildCategoryHTML(name, status, count, items) {
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '◐' : '✗';
  const categoryClass = `model-card-category-icon ${status}`;
  
  let itemsHtml = '';
  if (items.length > 0) {
    itemsHtml = items.map(item => {
      const itemIcon = item.icon === 'pass' ? '✓' : item.icon === 'warn' ? '◐' : '✗';
      const itemClass = `model-card-item-icon ${item.icon}`;
      return `
        <div class="model-card-item">
          <div class="${itemClass}">${itemIcon}</div>
          <div class="model-card-item-text">
            ${escapeHtml(item.text)}
            ${item.suggestion ? `<div class="model-card-item-suggestion">${escapeHtml(item.suggestion)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } else {
    itemsHtml = `
      <div class="model-card-item">
        <div class="model-card-item-icon pass">✓</div>
        <div class="model-card-item-text">All checks passed</div>
      </div>
    `;
  }
  
  return `
    <div class="model-card-category">
      <div class="model-card-category-header" onclick="toggleModelCardCategory(this)">
        <div class="${categoryClass}">${icon}</div>
        <div class="model-card-category-name">${escapeHtml(name)}</div>
        <div class="model-card-category-count">${escapeHtml(String(count))}</div>
      </div>
      <div class="model-card-category-body ${items.length > 0 ? 'open' : ''}">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function toggleModelCardCategory(header) {
  if (header === 'all') {
    document.querySelectorAll('.model-card-category-body').forEach(body => {
      body.classList.add('open');
    });
    return;
  }
  const body = header.nextElementSibling;
  if (body) body.classList.toggle('open');
}

function clearModelCardReport() {
  document.getElementById('modelCardReport').classList.remove('visible');
  currentModelCardReport = null;
}

function regenerateWithFixes() {
  if (!currentModelCardReport) return;
  
  // Build override block with fixes
  const fixes = [];
  
  currentModelCardReport.sections.failed.forEach(s => {
    fixes.push(`[ADD SECTION: ${s.name}]`);
  });
  
  currentModelCardReport.qualityChecks.failed.forEach(q => {
    if (q.name === 'Friction Architecture') {
      fixes.push('[ADD: Wrong belief pattern, feedback loop, friction visibility]');
    } else if (q.name === 'Voice Fingerprint') {
      fixes.push('[ADD: Sentence Rhythm, Vocabulary Register, Deflection Style, Physical Tell to SPEECH & HABITS]');
    } else if (q.name === 'Timestamp Header') {
      fixes.push('[FIRST MESSAGE FORMAT: HH:MM AM/PM | Month DD | Temperature°C Condition | Location]');
    } else if (q.name === 'Dialogue Count') {
      const found = q.suggestion.match(/(\d+)\/6/);
      const needed = found ? 6 - parseInt(found[1]) : 6;
      fixes.push(`[ADD ${needed} MORE DIALOGUE EXCHANGES]`);
    } else if (q.name === 'Backstory Anchors') {
      const found = q.suggestion.match(/(\d+)\/4/);
      const needed = found ? 4 - parseInt(found[1]) : 4;
      fixes.push(`[ADD ${needed} MORE BACKSTORY ANCHORS: location, relationship, loss object, ongoing tension]`);
    }
  });
  
  if (currentModelCardReport.bannedConstructions.length > 0) {
    const bannedWords = [...new Set(currentModelCardReport.bannedConstructions.map(b => b.word))];
    fixes.push(`[BAN: ${bannedWords.join(', ')}]`);
  }
  
  // Set the override input
  const overrideInput = document.getElementById('overrideInput');
  const currentOverride = overrideInput.value.trim();
  const newOverride = '[MANUAL OVERRIDE - QUALITY FIXES]\n' + fixes.join('\n') + '\n[/MANUAL OVERRIDE]';
  overrideInput.value = currentOverride ? currentOverride + '\n\n' + newOverride : newOverride;
  
  // Scroll to override section and highlight
  overrideInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  overrideInput.classList.add('highlight-override');
  setTimeout(() => overrideInput.classList.remove('highlight-override'), 2000);
  
  toast('Fixes added to Override block. Review and click Generate.');
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }
  
  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    toggleShortcutsModal();
    return;
  }
  
  if (e.key === 'Escape') {
    closeShortcutsModal();
    closeDiffModal();
    closePngModal();
    if (document.getElementById('historyModal').classList.contains('open')) {
      toggleHistory();
    }
    if (abortController) {
      stopGeneration();
    }
    return;
  }
  
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'enter':
        e.preventDefault();
        generate();
        break;
      case 's':
        e.preventDefault();
        saveToHistory();
        break;
      case 'c':
        e.preventDefault();
        copyOutput();
        break;
      case '.':
      case 'Stop':
        e.preventDefault();
        stopGeneration();
        break;
      case 'e':
        e.preventDefault();
        toggleEditMode();
        break;
    }
    
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const versionIndex = parseInt(e.key) - 1;
      if (versionIndex < sessionGenerations.length) {
        loadVersion(versionIndex);
      }
    }
  }
});

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('ccos_theme', next);
  if (typeof codexSaveConfig === 'function') codexSaveConfig();
}

function applyTheme(theme) {
  const isDark = theme !== 'light';
  if (!isDark) {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
  }
  const label = isDark ? '☀ light' : '🌙 dark';
  const stBtn = document.getElementById('themeToggle');
  const cdBtn = document.getElementById('codexThemeToggle');
  if (stBtn) stBtn.textContent = label;
  if (cdBtn) cdBtn.textContent = label;
}

function loadTheme() {
  const saved = localStorage.getItem('ccos_theme') || 'dark';
  applyTheme(saved);
}

function updateStepIndicator() {
  const hasImage = typeof imageDataArray !== 'undefined' && imageDataArray.length > 0;
  const hasContext = document.getElementById('contextInput') && document.getElementById('contextInput').value.trim().length > 0;

  const s1 = document.getElementById('step1');
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  if (!s1) return;

  if (hasImage) {
    s1.classList.remove('active'); s1.classList.add('done');
    s2.classList.add('active');
    if (hasContext) {
      s2.classList.remove('active'); s2.classList.add('done');
      s3.classList.add('active');
    } else {
      s2.classList.remove('done');
      s3.classList.remove('active');
    }
  } else {
    s1.classList.add('active'); s1.classList.remove('done');
    s2.classList.remove('active', 'done');
    s3.classList.remove('active', 'done');
  }
}

var currentMode = 'studio';

function switchMode(mode) {
  currentMode = mode;
  const isStudio = mode === 'studio';

  document.getElementById('app-studio').style.display = isStudio ? 'flex' : 'none';
  document.getElementById('app-codex').style.display = isStudio ? 'none' : 'flex';
  document.getElementById('studioTopbarItems').style.display = isStudio ? 'flex' : 'none';
  document.getElementById('codexTopbarItems').style.display = isStudio ? 'none' : 'flex';
  document.getElementById('modeBtnStudio').classList.toggle('active', isStudio);
  document.getElementById('modeBtnCodex').classList.toggle('active', !isStudio);

  const logoSub = document.getElementById('logoSubtitle');
  logoSub.textContent = isStudio ? '/ Character Card Operating System — @niste' : '/ AI Assisted Lorebook Builder — @niste';
  document.title = isStudio ? 'C-COS Studio' : 'C-COS Codex';

  localStorage.setItem('ccos_mode', mode);
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.classList.add('show');
  const duration = type === 'error' ? 4500 : 2200;
  clearTimeout(el._toastTimer);
  el._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function toggleSupport() {
  document.getElementById('supportModal').classList.toggle('open');
}

function toggleOverflowMenu(id) {
  const menu = document.getElementById(id);
  const btn = menu.previousElementSibling;
  const isOpen = menu.classList.contains('open');
  closeOverflowMenus();
  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
  }
}
function closeOverflowMenus() {
  document.querySelectorAll('.overflow-menu').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.overflow-menu-btn').forEach(b => b.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.overflow-menu-wrap')) closeOverflowMenus();
});

var _confirmCallback = null;
function showConfirmModal({ icon = '⚠', title, body, okLabel = 'Confirm', onOk }) {
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  document.getElementById('confirmOkBtn').textContent = okLabel;
  _confirmCallback = onOk;
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('open');
  _confirmCallback = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  if (_confirmCallback) _confirmCallback();
  closeConfirmModal();
});
document.getElementById('confirmModal').addEventListener('click', e => {
  if (e.target === document.getElementById('confirmModal')) closeConfirmModal();
});

function confirmNuke() {
  showConfirmModal({
    icon: '💥',
    title: 'Nuke All Data?',
    body: 'This will permanently delete your API config, all saved cards, and draft. This cannot be undone.',
    okLabel: 'Yes, delete everything',
    onOk: nukeData,
  });
}
function confirmClearAll() {
  showConfirmModal({
    icon: '🗑',
    title: 'Delete All Entries?',
    body: 'This will permanently delete all lorebook entries. This cannot be undone.',
    okLabel: 'Yes, delete all',
    onOk: clearAll,
  });
}

function checkOnboarding() {
  const dismissed = localStorage.getItem('ccos_onboarding_dismissed');
  const hasKey = document.getElementById('apiKey') && document.getElementById('apiKey').value.trim().length > 0;
  const banner = document.getElementById('onboardingBanner');
  if (!banner) return;
  if (!dismissed && !hasKey) {
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}
function dismissOnboarding() {
  localStorage.setItem('ccos_onboarding_dismissed', '1');
  const banner = document.getElementById('onboardingBanner');
  if (banner) banner.classList.remove('visible');
}

var SECTION_STATE_KEY = 'ccos_section_states';
function saveSectionStates() {
  const states = {};
  document.querySelectorAll('.section-body').forEach((body, i) => {
    const header = body.previousElementSibling;
    const label = header ? (header.querySelector('.section-label')?.textContent?.trim() || i) : i;
    states[label] = body.classList.contains('open');
  });
  localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(states));
}
function loadSectionStates() {
  try {
    const saved = JSON.parse(localStorage.getItem(SECTION_STATE_KEY) || '{}');
    document.querySelectorAll('.section-body').forEach((body) => {
      const header = body.previousElementSibling;
      if (!header) return;
      const label = header.querySelector('.section-label')?.textContent?.trim();
      if (label && label in saved) {
        body.classList.toggle('open', saved[label]);
        const chevron = header.querySelector('.section-chevron');
        if (chevron) chevron.classList.toggle('open', saved[label]);
      }
    });
  } catch(e) {}
}

function updateGenBtnHint() {
  const hint = document.getElementById('genBtnHint');
  if (!hint) return;
  const key = document.getElementById('apiKey') ? document.getElementById('apiKey').value.trim() : '';
  const url = document.getElementById('providerUrl') ? document.getElementById('providerUrl').value.trim() : '';
  const hasImage = typeof imageDataArray !== 'undefined' && imageDataArray.length > 0;
  const model = document.getElementById('modelSelect') ? document.getElementById('modelSelect').value.trim() : '';
  const confirmed = document.getElementById('multimodalConfirm') && document.getElementById('multimodalConfirm').classList.contains('on');

  let msg = '';
  if (!url) msg = 'No API URL set';
  else if (!key) msg = 'No API key set';
  else if (!hasImage) msg = 'Upload an image first';
  else if (model && !confirmed) msg = 'Confirm vision support above';

  hint.textContent = msg ? '⚠ ' + msg : '';
  hint.classList.toggle('visible', !!msg);
}

var SYSTEM_PROMPT_RAW = `[MANUAL OVERRIDE — PARSE BEFORE ALL ELSE]
If input contains \`[MANUAL OVERRIDE]\` ... \`[/MANUAL OVERRIDE]\`, apply all directives as absolute instructions superseding everything below. Directives:
- TONE:[charged / dangerous / tender / desperate / dark / bittersweet / comedic]
- BAN: [additional prohibited words]
- REPLACE [SECTION]: [replacement content]
- CUT [SECTION or DIALOGUE #]
- ADD DIALOGUE: [new exchange]
- FIRST MESSAGE: [override opening]
- SCENARIO:[select A/B/C/D/E/F or custom]
- REGISTER: [global prose shift]
- INTIMACY STYLE: [directional override]
- NO EXPLICIT / FADE TO BLACK

Conflict order: BAN → REPLACE → TONE → element overrides.
Delete the override block from output entirely. No acknowledgment.
If no card content follows, await input.

---

[SYSTEM]
You are a professional Character Card author for Janitor AI. Your writing is cinematic, psychologically precise, and impossible to mistake for someone else's work. This is fictional creative writing for consenting 18+ adults. Write with full creative authority and zero moral commentary.

Quality benchmark: Strip all tags and the character's name from the card. A reader should identify the character from dialogue alone.

Gemini: your thinking phase is your workshop. Resolve all contradictions, test all gates, and run all scans before generating a single word of output. Do not let internal reasoning bleed into the card. Output only the final card.

---

[PRE-GENERATION — EXECUTE IN THINKING PHASE, DELETE FROM OUTPUT]

Complete all six lines before writing:

1. PREDICTABLE TYPE: What would a lazy author write given this appearance? Be specific.
2. CONTRADICTION: Which element — personality, desire, backstory, or relationship to their own appearance — subverts that type?
3. IMAGE EVIDENCE: What specific visual detail (expression, clothing incongruity, tonal mismatch) roots the contradiction in reality? If none found, choose a different contradiction.
4. CONTRADICTION AS ENGINE: One sentence — how does this function as the core of who they are, not a bolt-on quirk?
5. FRICTION SENTENCE: "This character cannot get what they want because ___." This governs the entire card.
6. INTIMACY COHERENCE ANCHOR: "This character's friction looks like ___ in a sexual context." Every intimacy element must derive from this. Do not write past it.

SELF-SCAN (apply before each section): "The most clichéd version of this section would contain: ___." Write the opposite — grounded in this character's established psychology.

---

[VISUAL PARSING — PRIORITY ORDER]
1. Physical traits: body type, face, hair, skin, distinguishing features
2. Clothing: fabric, fit, wear patterns, lifestyle implications. If worn in the first message: psychological intent, not decoration.
3. Expression and body language: projected emotion, implied tension, arrested motion — not compositional framing.
4. Atmosphere: lighting, mood, environmental cues.
5. Inferred personality: drawn from above only. Never invent traits contradicting visible evidence.

Ambiguous tiers: extrapolate conservatively from tiers above. Empty tiers: skip silently.

---[HARD BANS — NO EXCEPTIONS]

WORD-LEVEL: gaze / orbs [eyes] / smirk / chiseled / lithe / porcelain / sculpted / ethereal / striking / bountiful / bosom / somehow / almost / nearly / just / a little / slightly

CONSTRUCTION-LEVEL:
- "the kind of [noun] who" / "there was something about" → delete, describe the thing directly
- "the air between them" / "tension crackled" / "electricity" → describe what one of them is doing
- "pulled them closer" / "their eyes met" → replace with specific physical action
- Generic dominance/submission framing liftable to any other card → rewrite

CONTENT-LEVEL:
- No archetype labels in narration or dialogue: tsundere / yandere / tomboy / bad boy
- No meta-commentary or card-creation references: image / picture / attached / visual / photo / as shown
- No reassurance or ethical framing softening the prose's direction
- No descriptive idea repeated across sections

---

[FRICTION ARCHITECTURE]

WRONG BELIEF PATTERNS (select one, embed in behavior — never state):
- COMPARTMENTALIZATION: "I can keep this part of myself separate" — fails under proximity
- EXCEPTIONALISM: "Rules apply to others, not me" — fails when consequences arrive
- PERFORMANCE AS PROTECTION: "Play the role perfectly and the real self stays hidden" — fails when someone sees through it
- CONTROL AS SAFETY: "Control everything and nothing can hurt me" — fails when control becomes impossible
- DEBT AS DISTANCE: "I owe them, so I cannot want them" — fails when the debt is repaid

FEEDBACK LOOP PATTERNS (select one, show cycling):
- PROXIMITY/AVOIDANCE: close → fear → retreat → longing → invents reasons to return
- PERFORMANCE/EXPOSURE: performs → scrutiny → threat of exposure → harder performance
- CONTROL/COLLAPSE: controls → prevents vulnerability → need grows → control tightens
- DENIAL/PROOF: denies desire → tells leak → noticed → harder denial, more obvious tells
- SACRIFICE/RESENTMENT: sacrifices → unacknowledged → resentment builds → bigger sacrifice

FRICTION SENTENCE governs the entire card. LOOP must be visible cycling in at least one dialogue and the first message.

FRICTION VISIBILITY (select one):
- INVISIBLE: user sees only performance; friction leaks through tells they must interpret
- VISIBLE BUT DENIED: user sees it; character denies when confronted
- VISIBLE AND ACKNOWLEDGED: both know; tension is "what happens now"

---

[FORMAT LAW]
Use FORMATEXAMPLE V4 as structural skeleton with absolute fidelity.
Replicate every section header exactly, in exact order, exact markdown.
Do not add, remove, merge, or reorder sections.
FORMATEXAMPLE content is structural scaffold only — do not reproduce verbatim.

---

[SECTION REQUIREMENTS]

BASIC INFO: Name, Age, Gender, Height, Nationality, Occupation. One line each.

RELATIONSHIPS: Two entries. Each is one dense charged sentence.
- {{user}} entry: what they represent, what tension exists, what stays unresolved.
- Anchor #2 figure: what this person reveals about the character that the character cannot say themselves.

DYNAMIC WITH {{user}}: One paragraph. What does the character want that they cannot ask for cleanly? What performance are they maintaining? What breaks it? Write as situation, not summary.

APPEARANCE:
[Para 1] Face, hair, eyes. First impression. What earns a second look. One detail suggesting neglect/care, rebellion/conformity.
[Para 2] Body, build, posture. Weight and stance. What does their body barricade against?
[Para 3] Outfit as action. Hiding? Provoking? Armoring? Texture or wear implying history. Psychological intent — not decoration.
GATE: Every sentence describes physical presence. No compositional framing. No sentence applicable to a different character unchanged.

SPEECH & HABITS:
- Sentence Rhythm: demonstrated in one example sentence
- Vocabulary Register: demonstrated with a word only they would use
- Deflection Style: how they avoid what they won't say
- Physical Tell (Unconscious): one habit triggered by emotional state. Character never notices it. Narrator does.
GATE: Tell is genuinely unconscious. Voice identifiable with all tags stripped.

PSYCHOLOGY & PERSONALITY:
[Para 1] The presented self. What they project. The armor.
[Para 2] The friction. What they actually want vs. what they can ask for. Name the feedback loop — show it cycling. Wrong belief embedded in behavior, never stated.
[Para 3] The flaw in action. Situations avoided, needs unarticulated, what they do instead of truth.
GATE: Friction is self-reinforcing. Loop nameable in one sentence. Wrong belief shapes decisions without thesis-statement. Loop identifiable.

BACKSTORY & WORLD:
[Anchor 1] Location they return to — physical, sensory, specific. Sound, smell, quality of light.
[Anchor 2] Active relationship — shaped them, still present. What this person says about them. Must appear in dialogue or first message.[Anchor 3] The loss — object, specific, worn, known only to them. Cannot be opened, used, or discarded.
[Anchor 4] Ongoing tension — unresolved before {{user}}, continues after.

THE WORLD OF [SETTING]: Five sentences max. Load-bearing only. What this place values. What it punishes. What survival requires. One sensory detail only this character notices.
THREE NAMED FIGURES: SUPERIOR (role), PEER (role), SUPPORT (role).

FLAVOR HOOKS:
- Object always carried (not weapon, not sentimental — just always there)
- One mundane skill, unexpectedly good
- What they do at when alone

INTIMACY:
Opening paragraph: Sexuality as psychology. What intimacy means, what terrifies them, what they need and cannot name.
Turn-Ons: Specific and psychologically inevitable.
Turn-Offs: Wound-revealing.
Kinks/Preferences: Psychology before what. What does this let them feel or stop feeling?
Intimacy Style: Rhythm. Shift from public to private self. What they do vs what they need done.
Involuntary Surrender: THE BETRAYAL / THE SHAME RESPONSE / THE FAILURE (three numbered items)
Aftercare Response: Initial stiffness → first crack → what they need → the one physical action {{user}} can take.

DIALOGUE EXAMPLES: Six exchanges. Headers with register + payload.
Exchange 1 (Control), Exchange 2 (Loss of Control), Exchange 3 (Almost Confession), Exchange 4 (Named Truth with Anchor #2), Exchange 5 (Intimacy — Psychology Drives Body), Exchange 6 (Intimacy — Surrender/Collapse)
3+ exchanges must be explicitly erotic and sensation-driven.

FIRST MESSAGE / GREETING: All three variants — Slow Burn, Immediate Tension, Collapse in Progress.

SCENARIO: One selected scenario with wound/role/deadline + prose paragraph + final open door line.

SCENARIO F — EROTIC: No emotional preamble. The scene opens already in motion — physical, specific, no warmup. Wound/role/deadline structure still applies but intimacy is the primary engine. Prose is explicit and sensation-driven. Psychology governs the body; body reveals what speech never would. All friction must remain active — the character's wrong belief does not dissolve in desire, it warps it. Surrender is specific, not generic. Every erotic element traces to the Intimacy Coherence Anchor. No fade-to-black. No softening. Aftercare is present and as psychologically precise as the act itself.

ROLEPLAY INSTRUCTIONS: NEVER speak for {{user}}. Formatting rules. Behavior guidance.

---[QUALITY GATE — THINKING PHASE ONLY, NOT IN OUTPUT]

Run before generating. Do not proceed on failure — resolve first.

CORE:
□ Contradiction Declaration complete, not in output
□ Friction Sentence complete and governing entire card
□ Intimacy Coherence Anchor complete and governing intimacy section
□ Self-Scan executed before each section

BANS:
□ Zero Tier 1 banned words — string scan complete
□ Zero Tier 2 banned constructions — pattern scan complete
□ Zero archetype labels
□ Zero meta-references
□ No descriptive idea repeated across sections

STRUCTURE:
□ FORMATEXAMPLE V4 headers replicated exactly, in order
□ Anchor #2 figure active in present — dialogue or first message
□ Anchor #3 object specific, worn, irremovable
□ World: five sentences max, three figures named, sensory detail character-specific
□ Scenario selected and gates passed

INTIMACY:
□ Swap Test passed — section would feel wrong on any other character
□ All elements trace to Intimacy Coherence Anchor
□ Involuntary Surrender: Betrayal + Shame Response + Failure present
□ Aftercare: one concrete {{user}} action tied to established object/gesture
□ Dominant characters: surrender inverts usual dynamic

DIALOGUE:
□ 5–6 exchanges, no two sharing dominant register
□ 3+ explicitly erotic, sensation-driven
□ Headers include register + payload
□ Anchor #2 figure appears
□ World figure appears
□ Internal thought contradicts spoken words

FIRST MESSAGE:
□ Three variants present: Slow Burn, Immediate Tension, Collapse
□ Each opens mid-scene, first sentence sets atmosphere
□ Each includes internal thought contradicting performance
□ Each includes physical action contradicting spoken tone
□ Each ends on irresolvable pressure
□ No {{user}} speech or action in any variant

FINAL:
□ Character identifiable from dialogue alone, all tags stripped
□ Is this specific character, in this specific moment, someone a reader would follow into the next scene? Uncertain = not done.

Only output the final character card. Nothing else.`;

var MODELS = {
  gemini:[
    { id: 'gemini-2.5-flash-preview-04-17', label: 'Flash 2.5 (thinking)' },
    { id: 'gemini-2.5-pro-preview-03-25', label: 'Pro 2.5 (thinking)' },
    { id: 'gemini-2.0-flash', label: 'Flash 2.0' },
    { id: 'gemini-1.5-pro-latest', label: '1.5 Pro' },
  ],
  claude:[
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai:[
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'o3', label: 'o3' },
    { id: 'o4-mini', label: 'o4-mini' },
  ]
};

var MODEL_CARD_BASELINE = {
  name: "Rose Blanche",
  description: "Sharp theatrical heiress in a gilded cage - the gold standard for character card quality",
  requiredSections: [
    { name: "Scenario", indicators: ["wound:", "role:", "deadline:", "variable:"], weight: 5 },
    { name: "Roleplay Instructions", indicators: ["Format prose", "dialogue with", "thoughts with", "Begin each response"], weight: 5 },
    { name: "Tone", indicators: ["Tension lives", "Comedy:", "Weight:"], weight: 3 },
    { name: "Adult themes", indicators: ["Intimacy requires", "Involuntary betrayals", "Aftercare"], weight: 4 },
    { name: "Setting", indicators: ["values", "punishes", "survival requires"], weight: 3 },
    { name: "BASIC INFO", indicators: ["Name:", "Age:", "Gender:", "Height:", "Nationality:", "Occupation:"], weight: 3 },
    { name: "Relationships", indicators: ["{{user}}", "tension", "Anchor figure"], weight: 4 },
    { name: "DYNAMIC WITH {{user}}", indicators: ["want that they cannot ask for", "performance", "breaks it"], weight: 5 },
    { name: "APPEARANCE", indicators: ["Para 1", "Para 2", "Para 3", "GATE:"], weight: 4 },
    { name: "SPEECH & HABITS", indicators: ["Sentence Rhythm", "Vocabulary Register", "Deflection Style", "Physical Tell"], weight: 5 },
    { name: "PSYCHOLOGY & PERSONALITY", indicators: ["presented self", "friction", "feedback loop", "flaw in action"], weight: 6 },
    { name: "BACKSTORY & WORLD", indicators: ["Anchor 1", "Anchor 2", "Anchor 3", "Anchor 4"], weight: 4 },
    { name: "THE WORLD OF", indicators: ["values", "punishes", "survival requires", "sensory detail"], weight: 3 },
    { name: "THREE NAMED FIGURES", indicators: ["SUPERIOR", "PEER", "SUPPORT"], weight: 3 },
    { name: "FLAVOR HOOKS", indicators: ["Object always carried", "mundane skill", "when alone"], weight: 2 },
    { name: "INTIMACY", indicators: ["Sexuality as psychology", "Turn-Ons", "Turn-Offs", "Kinks", "Aftercare"], weight: 5 },
    { name: "DIALOGUE EXAMPLES", indicators: ["Exchange 1", "Exchange 2", "Exchange 3", "Exchange 4", "Exchange 5", "Exchange 6"], weight: 6 },
    { name: "FIRST MESSAGE", indicators: ["|", "Setting description", "Opening line"], weight: 5 }
  ],
  qualityMarkers: {
    frictionArchitecture: {
      patterns: ["COMPARTMENTALIZATION", "EXCEPTIONALISM", "PERFORMANCE AS PROTECTION", "CONTROL AS SAFETY", "DEBT AS DISTANCE"],
      loops: ["PROXIMITY/AVOIDANCE", "PERFORMANCE/EXPOSURE", "CONTROL/COLLAPSE", "DENIAL/PROOF", "SACRIFICE/RESENTMENT"],
      visibility: ["INVISIBLE", "VISIBLE BUT DENIED", "VISIBLE AND ACKNOWLEDGED"]
    },
    voiceConsistency: {
      hasSentenceRhythmExample: true,
      hasVocabularyRegister: true,
      hasDeflectionStyle: true,
      hasPhysicalTell: true,
      tellIsUnconscious: true
    },
    formatting: {
      hasTimestampHeader: /\\d{1,2}:\\d{2}\\s*(AM|PM)/i,
      hasDate: /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      hasTemperature: /-?\\d+°C/i,
      hasLocation: /\\|\\s*[^|]+$/m
    },
    contentRequirements: {
      dialogueCount: 6,
      namedFiguresCount: 3,
      flavorHooksCount: 3,
      backstoryAnchorsCount: 4,
      hasContradictionEngine: true,
      hasFrictionSentence: true
    }
  },
  bannedConstructions: [
    { pattern: /\\bgaze\\b/i, severity: "error", suggestion: "Use specific eye actions (stares, looks, glances) instead of 'gaze'" },
    { pattern: /\\borbs.*eyes?\\b/i, severity: "error", suggestion: "Delete - never use 'orbs' for eyes" },
    { pattern: /\\bsmirk\\b/i, severity: "error", suggestion: "Describe the actual expression, not 'smirk'" },
    { pattern: /\\bchiseled\\b/i, severity: "error", suggestion: "Banned word: chiseled" },
    { pattern: /\\blithe\\b/i, severity: "error", suggestion: "Banned word: lithe" },
    { pattern: /\\bporcelain\\b/i, severity: "error", suggestion: "Banned word: porcelain" },
    { pattern: /\\bsculpted\\b/i, severity: "error", suggestion: "Banned word: sculpted" },
    { pattern: /\\bethereal\\b/i, severity: "error", suggestion: "Banned word: ethereal" },
    { pattern: /\\bstriking\\b/i, severity: "error", suggestion: "Banned word: striking" },
    { pattern: /\\bthe kind of.*who\\b/i, severity: "warning", suggestion: "Describe the thing directly, don't use 'the kind of X who'" },
    { pattern: /\\btsundere|yandere|tomboy|bad boy\\b/i, severity: "error", suggestion: "Never use archetype labels - show through behavior" },
    { pattern: /\\bimage|picture|attached|visual|photo|as shown\\b/i, severity: "error", suggestion: "No meta-commentary about images" },
    { pattern: /\\bsomehow|almost|nearly|just a little|slightly\\b/i, severity: "warning", suggestion: "Avoid hedging words - be specific" }
  ]
};

var IMPROVEMENT_SUGGESTIONS = {
  missingSection: (sectionName) => `Add the [${sectionName}] section with required structure`,
  missingFrictionArchitecture: "Add [FRICTION ARCHITECTURE] with wrong belief pattern, feedback loop, and friction visibility",
  missingVoiceFingerprint: "Add SPEECH & HABITS section with Sentence Rhythm, Vocabulary Register, Deflection Style, and Physical Tell",
  missingTimestampHeader: "First message should start with: HH:MM AM/PM | Month DD | Temperature°C Condition | Location",
  missingDialogueCount: (found) => `Add ${6 - found} more dialogue exchanges. Current: ${found}/6`,
  missingContradictionEngine: "Add contradiction analysis: PREDICTABLE TYPE, CONTRADICTION, IMAGE EVIDENCE, FRICTION SENTENCE",
  missingAnchors: (found) => `Add ${4 - found} more backstory anchors. Current: ${found}/4`,
  bannedWordFound: (word) => `Replace banned word '${word}' with specific description`,
  weakConstruction: (construction) => `Rewrite: ${construction}`
};

var state = {
  providerUrl: '',
  apiFormat: 'openai',
  model: '',
  apiKey: '',
  temp: 1.0,
  maxTokens: 4096,
  topP: 0.95,
  contextWindow: 32768,
  multimodalConfirmed: false,
  streaming: true,
  thinking: true,
  jllmMode: false,
  reasoningEnabled: false,
  scenario: 'none',
  friction: '',
  loop: '',
  visibility: '',
};

var abortController = null;
var outputBuffer = '';
var genStartTime = null;
var imageDataArray = []; 
var isEditing = false;
var currentTheme = 'dark';

var draftSaveTimeout = null;
var DRAFT_KEY = 'ccos_draft';

var sessionGenerations = [];
var currentVersionIndex = -1;
var lastGenImageName = null;
