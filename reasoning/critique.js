// reasoning/critique.js - Step 4: Semantic Critique
// Runs semantic quality gates and model card scoring on generated card

const SEMANTIC_CRITIQUE_PROMPT = `You are a ruthless quality gate for character cards.

TASK: Evaluate this character card against quality criteria. Be honest about failures. Suggest specific fixes.

OUTPUT FORMAT - Return ONLY JSON:

{
  "meetsThreshold": true/false,
  "requiresFix": true/false,
  "score": 0-100,
  "gates": [
    {
      "id": "gate_name",
      "passed": true/false,
      "severity": "critical/warning/info",
      "finding": "What you found",
      "evidence": "Specific quote from card",
      "fix": "Specific instruction to fix"
    }
  ],
  "semanticAnalysis": {
    "contradiction": {
      "grounded": true/false,
      "drivesBehavior": true/false,
      "evidenceQuote": "Quote showing contradiction in action"
    },
    "friction": {
      "sentenceMatchesContent": true/false,
      "visibleInPsychology": true/false,
      "visibleInDialogue": true/false,
      "visibleInIntimacy": true/false
    },
    "voice": {
      "identifiable": true/false,
      "consistentAcrossDialogue": true/false,
      "registers": ["list of detected registers"],
      "registerOverlap": ["dialogues that sound too similar"]
    },
    "sections": {
      "appearanceGrounded": true/false,
      "psychologyCoherent": true/false,
      "anchorsSpecific": true/false,
      "worldLoadBearing": true/false
    }
  },
  "bannedConstructions": [
    {
      "word": "banned word found",
      "location": "section where found",
      "severity": "error/warning"
    }
  ],
  "fixes": [
    {
      "priority": 1-10,
      "section": "which section",
      "instruction": "specific fix to apply"
    }
  ]
}

GATE DEFINITIONS:

contradiction_grounded: Contradiction roots in visual evidence? Not bolt-on?
contradiction_engine: Does it drive behavior or just sit in backstory?
friction_governs: Does friction sentence govern psychology, dialogue, intimacy?
friction_loop_cyclic: Can you trace the feedback loop cycling?
voice_identifiable: Would dialogue alone identify this character?
voice_consistent: Same voice across all 6 exchanges? No drift?
section_appearance: Every sentence physical presence? No compositional framing?
section_psychology: Friction self-reinforcing? Loop nameable? Wrong belief embedded?
section_anchors: All 4 anchors specific, sensory, load-bearing?
section_intimacy: All elements trace to coherence anchor? Swap test passed?
dialogue_registers: 3+ distinct registers? 3+ erotic/sensory?
dialogue_anchor2: Anchor #2 figure appears in dialogue?
first_message_variants: All 3 variants present (Slow Burn, Immediate, Collapse)?
first_message_no_user: No {{user}} speech or action in any variant?
bans_compliance: Zero banned words and constructions?

SCORING:
- Start at 100
- Critical failure: -15 each
- Warning: -5 each
- Info: -0

THRESHOLDS:
- 85+: meetsThreshold=true, requiresFix=false
- 70-84: meetsThreshold=true, requiresFix=true
- Below 70: meetsThreshold=false, requiresFix=true

Be strict. A "pass" should mean genuinely excellent work.`;

const BANNED_WORDS = [
  'gaze', 'orbs', 'smirk', 'chiseled', 'lithe', 'porcelain', 
  'sculpted', 'ethereal', 'striking', 'bountiful', 'bosom',
  'somehow', 'almost', 'nearly', 'just', 'a little', 'slightly'
];

const BANNED_PATTERNS = [
  { pattern: /the kind of \w+ who/gi, severity: 'error', name: 'kind_of_construction' },
  { pattern: /there was something about/gi, severity: 'error', name: 'something_about' },
  { pattern: /the air between them|tension crackled|electricity/i, severity: 'error', name: 'abstract_tension' },
  { pattern: /tsundere|yandere|tomboy|bad boy|dominant|submissive/i, severity: 'error', name: 'archetype_label' },
  { pattern: /image|picture|attached|visual|photo|as shown/i, severity: 'warning', name: 'meta_reference' }
];

async function runSemanticCritique(inputs, signal) {
  const {
    cardContent,
    psychology,
    iteration,
    // Optional: for LLM fallback
    model,
    apiFormat,
    providerUrl,
    apiKey,
    temperature,
    topP
  } = inputs;

  // Pre-compute simple checks
  const bannedFindings = _checkBannedConstructions(cardContent);
  const dialogueData = _extractDialogueData(cardContent);
  
  // Step 1: Fast heuristic critique (always runs)
  const heuristicResult = _heuristicCritique(cardContent, psychology, bannedFindings, dialogueData);
  
  // Step 2: Check if LLM second opinion is needed
  // Borderline scores (70-84) or uncertain critical gates need deeper analysis
  const hasUncertainCriticalGates = heuristicResult.gates.some(g => 
    (g.id === 'contradiction_grounded' || g.id === 'friction_governs' || g.id === 'voice_identifiable') &&
    g.passed === null
  );
  const isBorderline = heuristicResult.score >= 70 && heuristicResult.score < 85;
  const needsLLM = isBorderline || hasUncertainCriticalGates;
  
  let finalResult = heuristicResult;
  let llmResult = null;
  
  // Step 3: LLM critique for borderline cases (if API credentials available)
  if (needsLLM && apiFormat && providerUrl && apiKey) {
    try {
      const critiqueContext = _buildCritiqueContext(cardContent, psychology, bannedFindings, dialogueData, iteration);
      llmResult = await _llmCritique({
        apiFormat, providerUrl, apiKey, model, temperature, topP,
        critiqueContext
      }, signal);
      
      // Merge: use LLM for semantic gates it can evaluate, keep heuristic for objective gates
      finalResult = _mergeCritiqueResults(heuristicResult, llmResult);
    } catch (error) {
      console.warn('LLM critique failed, using heuristic only:', error.message);
      // Continue with heuristic result
    }
  }
  
  return {
    ...finalResult,
    _metadata: {
      step: 'critique',
      timestamp: Date.now(),
      iteration,
      usedLLM: !!llmResult,
      borderlineTriggered: isBorderline,
      uncertainGatesTriggered: hasUncertainCriticalGates
    }
  };
}

function _buildCritiqueContext(cardContent, psychology, bannedFindings, dialogueData, iteration) {
  return `
[ITERATION ${iteration}]

[ORIGINAL PSYCHOLOGY BLUEPRINT]
Friction Sentence: ${psychology.frictionSentence || 'Unknown'}
Wrong Belief: ${psychology.wrongBelief || 'Unknown'}
Feedback Loop: ${psychology.feedbackLoop || 'Unknown'}
Intimacy Coherence: ${psychology.intimacyCoherenceAnchor || 'Unknown'}
Voice Fingerprint: ${JSON.stringify(psychology.voiceFingerprint) || 'Unknown'}

[CHARACTER CARD TO EVALUATE]
${cardContent.substring(0, 8000)}${cardContent.length > 8000 ? '\n\n[...truncated for length...]' : ''}

[PRE-COMPUTED DATA]
Banned words found: ${JSON.stringify(bannedFindings.words.slice(0, 10))}
Banned patterns found: ${JSON.stringify(bannedFindings.patterns.slice(0, 5))}
Dialogue exchanges detected: ${dialogueData.count}
Registers found: ${JSON.stringify(dialogueData.registers)}

Evaluate rigorously. Return JSON only.`;
}

function _checkBannedConstructions(text) {
  const lowerText = text.toLowerCase();
  const wordsFound = [];
  const patternsFound = [];
  
  // Check banned words
  BANNED_WORDS.forEach(word => {
    if (lowerText.includes(word.toLowerCase())) {
      // Find all occurrences with context
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + word.length + 30);
        wordsFound.push({
          word,
          context: text.substring(start, end),
          index: match.index
        });
      }
    }
  });
  
  // Check banned patterns
  BANNED_PATTERNS.forEach(({ pattern, severity, name }) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        patternsFound.push({
          pattern: name,
          match: match.substring(0, 50),
          severity
        });
      });
    }
  });
  
  return { words: wordsFound, patterns: patternsFound };
}

function _extractDialogueData(text) {
  // Extract dialogue exchanges
  const exchangeMatches = text.match(/Exchange\s*\d|Dialogue\s*\d/gi) || [];
  const exchanges = [];
  
  // Try to extract register information from headers
  const lines = text.split('\n');
  let currentExchange = null;
  
  lines.forEach(line => {
    const headerMatch = line.match(/Exchange\s*(\d)[\s:]*(\([^)]*\))?(.*)/i) ||
                        line.match(/Dialogue\s*(\d)[\s:]*(\([^)]*\))?(.*)/i);
    
    if (headerMatch) {
      if (currentExchange) {
        exchanges.push(currentExchange);
      }
      currentExchange = {
        number: parseInt(headerMatch[1]),
        register: (headerMatch[2] || headerMatch[3] || '').replace(/[()]/g, '').trim(),
        content: []
      };
    } else if (currentExchange && line.trim()) {
      currentExchange.content.push(line);
    }
  });
  
  if (currentExchange) {
    exchanges.push(currentExchange);
  }
  
  // Analyze registers
  const registers = [...new Set(exchanges.map(e => e.register).filter(Boolean))];
  
  // Check for erotic content
  const eroticIndicators = ['erotic', 'intimacy', 'surrender', 'sensation', 'touch', 'skin', 'body'];
  const eroticCount = exchanges.filter(e => {
    const content = e.content.join(' ').toLowerCase();
    return eroticIndicators.some(ind => content.includes(ind));
  }).length;
  
  return {
    count: exchanges.length,
    exchanges,
    registers,
    eroticCount,
    hasSixExchanges: exchanges.length >= 6,
    hasThreeErotic: eroticCount >= 3
  };
}

function _heuristicCritique(text, psychology, bannedFindings, dialogueData) {
  const gates = [];
  let score = 100;
  
  // Check banned constructions (critical)
  if (bannedFindings.words.length > 0) {
    gates.push({
      id: 'bans_words',
      passed: false,
      severity: 'critical',
      finding: `Found ${bannedFindings.words.length} banned words`,
      evidence: bannedFindings.words.slice(0, 3).map(w => w.word).join(', '),
      fix: `Remove banned words: ${bannedFindings.words.slice(0, 5).map(w => w.word).join(', ')}`
    });
    score -= bannedFindings.words.length * 3;
  } else {
    gates.push({
      id: 'bans_words',
      passed: true,
      severity: 'info',
      finding: 'No banned words found',
      evidence: '',
      fix: ''
    });
  }
  
  if (bannedFindings.patterns.length > 0) {
    const criticalPatterns = bannedFindings.patterns.filter(p => p.severity === 'error');
    if (criticalPatterns.length > 0) {
      gates.push({
        id: 'bans_patterns',
        passed: false,
        severity: 'critical',
        finding: `Found ${criticalPatterns.length} banned construction patterns`,
        evidence: criticalPatterns.slice(0, 2).map(p => p.pattern).join(', '),
        fix: 'Rewrite using specific physical descriptions instead of abstract constructions'
      });
      score -= criticalPatterns.length * 5;
    } else {
      gates.push({
        id: 'bans_patterns',
        passed: true,
        severity: 'warning',
        finding: `${bannedFindings.patterns.length} minor patterns found`,
        evidence: bannedFindings.patterns.map(p => p.pattern).join(', '),
        fix: 'Review and remove meta-references'
      });
      score -= bannedFindings.patterns.length * 1;
    }
  } else {
    gates.push({
      id: 'bans_patterns',
      passed: true,
      severity: 'info',
      finding: 'No banned patterns found',
      evidence: '',
      fix: ''
    });
  }
  
  // Check dialogue count
  if (dialogueData.hasSixExchanges) {
    gates.push({
      id: 'dialogue_count',
      passed: true,
      severity: 'info',
      finding: `Found ${dialogueData.count} dialogue exchanges`,
      evidence: '',
      fix: ''
    });
  } else {
    gates.push({
      id: 'dialogue_count',
      passed: false,
      severity: 'critical',
      finding: `Only ${dialogueData.count}/6 dialogue exchanges present`,
      evidence: `Found exchanges: ${dialogueData.exchanges.map(e => e.number).join(', ')}`,
      fix: `Add ${6 - dialogueData.count} more dialogue exchanges with varied registers`
    });
    score -= (6 - dialogueData.count) * 5;
  }
  
  // Check erotic dialogue
  if (dialogueData.hasThreeErotic) {
    gates.push({
      id: 'dialogue_erotic',
      passed: true,
      severity: 'info',
      finding: `${dialogueData.eroticCount}/6 exchanges are erotic/sensory`,
      evidence: '',
      fix: ''
    });
  } else {
    gates.push({
      id: 'dialogue_erotic',
      passed: false,
      severity: 'warning',
      finding: `Only ${dialogueData.eroticCount}/6 exchanges are explicitly erotic`,
      evidence: '',
      fix: `Add ${3 - dialogueData.eroticCount} more sensation-driven erotic exchanges`
    });
    score -= (3 - dialogueData.eroticCount) * 3;
  }
  
  // Check registers
  if (dialogueData.registers.length >= 3) {
    gates.push({
      id: 'dialogue_registers',
      passed: true,
      severity: 'info',
      finding: `Found ${dialogueData.registers.length} distinct registers`,
      evidence: dialogueData.registers.join(', '),
      fix: ''
    });
  } else {
    gates.push({
      id: 'dialogue_registers',
      passed: false,
      severity: 'warning',
      finding: `Only ${dialogueData.registers.length} distinct registers`,
      evidence: `Registers: ${dialogueData.registers.join(', ') || 'none detected'}`,
      fix: 'Ensure dialogue headers show variety: Control, Loss of Control, Almost Confession, etc.'
    });
    score -= 5;
  }
  
  // Check required sections
  const requiredSections = [
    'BASIC INFO', 'RELATIONSHIPS', 'DYNAMIC', 'APPEARANCE',
    'SPEECH & HABITS', 'PSYCHOLOGY', 'BACKSTORY', 'WORLD',
    'INTIMACY', 'DIALOGUE', 'FIRST MESSAGE'
  ];
  
  const missingSections = requiredSections.filter(section => 
    !text.toUpperCase().includes(section.toUpperCase())
  );
  
  if (missingSections.length === 0) {
    gates.push({
      id: 'sections_complete',
      passed: true,
      severity: 'info',
      finding: 'All required sections present',
      evidence: '',
      fix: ''
    });
  } else {
    gates.push({
      id: 'sections_complete',
      passed: false,
      severity: 'critical',
      finding: `Missing sections: ${missingSections.join(', ')}`,
      evidence: '',
      fix: `Add the missing sections: ${missingSections.join(', ')}`
    });
    score -= missingSections.length * 10;
  }
  
  // Check friction sentence governance (simplified check)
  const frictionPresent = text.toLowerCase().includes(psychology.frictionSentence?.toLowerCase().substring(0, 30) || '');
  if (frictionPresent || text.toLowerCase().includes('friction')) {
    gates.push({
      id: 'friction_present',
      passed: true,
      severity: 'info',
      finding: 'Friction architecture referenced',
      evidence: '',
      fix: ''
    });
  } else {
    gates.push({
      id: 'friction_present',
      passed: false,
      severity: 'warning',
      finding: 'Friction sentence not clearly governing content',
      evidence: '',
      fix: `Ensure psychology section reflects: ${psychology.frictionSentence}`
    });
    score -= 10;
  }
  
  // Check voice fingerprint markers
  const voiceMarkers = ['sentence rhythm', 'vocabulary register', 'deflection style', 'physical tell'];
  const foundMarkers = voiceMarkers.filter(marker => 
    text.toLowerCase().includes(marker)
  );
  
  if (foundMarkers.length >= 3) {
    gates.push({
      id: 'voice_fingerprint',
      passed: true,
      severity: 'info',
      finding: `Found ${foundMarkers.length}/4 voice fingerprint markers`,
      evidence: foundMarkers.join(', '),
      fix: ''
    });
  } else {
    gates.push({
      id: 'voice_fingerprint',
      passed: false,
      severity: 'warning',
      finding: `Only ${foundMarkers.length}/4 voice fingerprint markers`,
      evidence: `Found: ${foundMarkers.join(', ') || 'none'}`,
      fix: `Add missing markers to SPEECH & HABITS: ${voiceMarkers.filter(m => !foundMarkers.includes(m)).join(', ')}`
    });
    score -= (4 - foundMarkers.length) * 3;
  }
  
  // Normalize score
  score = Math.max(0, Math.min(100, score));
  
  // Determine threshold status
  const meetsThreshold = score >= 70;
  const requiresFix = score < 85;
  
  // Generate fixes from failed gates
  const fixes = gates
    .filter(g => !g.passed && g.fix)
    .map((g, idx) => ({
      priority: g.severity === 'critical' ? 10 : g.severity === 'warning' ? 5 : 3,
      section: g.id.replace(/_/g, ' '),
      instruction: g.fix
    }))
    .sort((a, b) => b.priority - a.priority);
  
  return {
    meetsThreshold,
    requiresFix,
    score,
    gates,
    semanticAnalysis: {
      contradiction: {
        grounded: gates.some(g => g.id === 'contradiction_grounded' && g.passed) || null,
        drivesBehavior: gates.some(g => g.id === 'friction_present' && g.passed) || null,
        evidenceQuote: ''
      },
      friction: {
        sentenceMatchesContent: gates.some(g => g.id === 'friction_present' && g.passed) || null,
        visibleInPsychology: null,
        visibleInDialogue: null,
        visibleInIntimacy: null
      },
      voice: {
        identifiable: foundMarkers.length >= 3,
        consistentAcrossDialogue: null,
        registers: dialogueData.registers,
        registerOverlap: []
      },
      sections: {
        appearanceGrounded: null,
        psychologyCoherent: gates.some(g => g.id === 'friction_present' && g.passed) || null,
        anchorsSpecific: null,
        worldLoadBearing: null
      }
    },
    bannedConstructions: [
      ...bannedFindings.words.map(w => ({ word: w.word, location: w.context.substring(0, 50), severity: 'error' })),
      ...bannedFindings.patterns.map(p => ({ word: p.pattern, location: p.match, severity: p.severity }))
    ],
    fixes
  };
}

// LLM-based critique for borderline cases (hybrid approach)
async function _llmCritique(inputs, signal) {
  const { apiFormat, providerUrl, apiKey, model, temperature, topP, critiqueContext } = inputs;
  
  let response;
  
  try {
    switch (apiFormat) {
      case 'gemini':
        response = await _callGeminiForCritique(providerUrl, apiKey, model,
          SEMANTIC_CRITIQUE_PROMPT, critiqueContext, { temperature, topP }, signal);
        break;
      case 'claude':
        response = await _callClaudeForCritique(providerUrl, apiKey, model,
          SEMANTIC_CRITIQUE_PROMPT, critiqueContext, { temperature, topP }, signal);
        break;
      default:
        response = await _callOpenAIForCritique(providerUrl, apiKey, model,
          SEMANTIC_CRITIQUE_PROMPT, critiqueContext, { temperature, topP }, signal);
    }
  } catch (error) {
    console.error('LLM critique API call failed:', error);
    throw error;
  }
  
  // Parse JSON response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                      response.match(/```\s*([\s\S]*?)```/) ||
                      response.match(/\{[\s\S]*\}/);
    
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
    const parsed = JSON.parse(jsonStr);
    
    return {
      meetsThreshold: parsed.meetsThreshold,
      requiresFix: parsed.requiresFix,
      score: parsed.score,
      gates: parsed.gates || [],
      semanticAnalysis: parsed.semanticAnalysis || {},
      bannedConstructions: parsed.bannedConstructions || [],
      fixes: parsed.fixes || []
    };
  } catch (parseError) {
    console.error('Failed to parse LLM critique JSON:', parseError);
    // Return partial result if we can extract score
    return {
      meetsThreshold: null,
      requiresFix: null,
      score: null,
      gates: [],
      parseError: true
    };
  }
}

// Merge heuristic and LLM results - use LLM for semantic gates, heuristic for objective
function _mergeCritiqueResults(heuristic, llm) {
  // Objective gates (heuristic is authoritative)
  const objectiveGateIds = ['bans_words', 'bans_patterns', 'dialogue_count', 'dialogue_erotic', 'sections_complete'];
  
  // Semantic gates (LLM is authoritative if available)
  const semanticGateIds = ['contradiction_grounded', 'contradiction_engine', 'friction_governs', 
                          'friction_loop_cyclic', 'voice_identifiable', 'voice_consistent'];
  
  const mergedGates = [];
  const llmGateMap = new Map(llm.gates.map(g => [g.id, g]));
  
  // Process all heuristic gates
  heuristic.gates.forEach(hGate => {
    const lGate = llmGateMap.get(hGate.id);
    
    if (objectiveGateIds.includes(hGate.id)) {
      // Use heuristic for objective gates
      mergedGates.push(hGate);
    } else if (semanticGateIds.includes(hGate.id) && lGate) {
      // Use LLM for semantic gates if available
      mergedGates.push(lGate);
    } else if (lGate && hGate.passed === null) {
      // LLM filled in a gap
      mergedGates.push(lGate);
    } else {
      // Default to heuristic
      mergedGates.push(hGate);
    }
  });
  
  // Add any LLM-only gates
  llm.gates.forEach(lGate => {
    if (!heuristic.gates.some(h => h.id === lGate.id)) {
      mergedGates.push(lGate);
    }
  });
  
  // Use LLM score if significantly different, otherwise heuristic
  let finalScore = heuristic.score;
  if (llm.score !== null && Math.abs(llm.score - heuristic.score) > 10) {
    // Significant disagreement - prefer LLM for semantic evaluation
    finalScore = Math.round((llm.score + heuristic.score) / 2);
  }
  
  return {
    meetsThreshold: finalScore >= 70,
    requiresFix: finalScore < 85,
    score: finalScore,
    gates: mergedGates,
    semanticAnalysis: llm.semanticAnalysis || heuristic.semanticAnalysis,
    bannedConstructions: heuristic.bannedConstructions, // Heuristic has better context
    fixes: llm.fixes?.length > 0 ? llm.fixes : heuristic.fixes // Prefer LLM fixes if available
  };
}

// API wrappers for LLM critique
async function _callGeminiForCritique(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${key}`;
  
  const body = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: userMessage }] 
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: (params.temperature || 0.7) - 0.2, // Lower temp for consistent evaluation
      maxOutputTokens: 4096,
      topP: params.topP || 0.95,
      responseMimeType: 'application/json'
    }
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }
  
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function _callClaudeForCritique(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';
  
  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ 
      role: 'user', 
      content: [{ type: 'text', text: userMessage }] 
    }],
    temperature: (params.temperature || 0.7) - 0.2,
    top_p: params.topP || 0.95
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
    signal
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }
  
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function _callOpenAIForCritique(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: (params.temperature || 0.7) - 0.2,
    max_tokens: 4096,
    top_p: params.topP || 0.95
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify(body),
    signal
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }
  
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
