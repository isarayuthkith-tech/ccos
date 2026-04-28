// reasoning/fix.js - Step 5: Fix Iteration
// Applies fixes to the card based on critique results

const FIX_ITERATION_PROMPT = `You are a surgical editor for character cards. Apply specific fixes while preserving what works.

TASK: Fix the identified issues in this character card. Maintain the psychology blueprint and voice fingerprint.

[APPROACH]
1. Preserve the working elements - don't rewrite what passes gates
2. Target only the failed gates with surgical precision  
3. Maintain voice consistency across all changes
4. Keep the friction architecture intact

[FIX PRIORITIES]
CRITICAL: Banned words, missing sections, broken friction architecture
WARNING: Register variety, voice fingerprint markers, anchor specificity
INFO: Polish, tightening, minor clarifications

[OUTPUT RULES]
- Return the complete revised card
- Include all sections, not just fixes
- Ensure fixes don't introduce new banned constructions
- Verify voice remains consistent
- Confirm friction sentence still governs

Output only the revised card. No commentary.`;

async function runFixIteration(inputs, signal) {
  const {
    cardContent,
    critique,
    psychology,
    iteration
  } = inputs;

  if (!critique.requiresFix || critique.fixes.length === 0) {
    return {
      content: cardContent,
      changes: [],
      _metadata: {
        step: 'fix',
        timestamp: Date.now(),
        iteration,
        skipped: true
      }
    };
  }

  // Build fix instructions
  const fixContext = `
[ITERATION ${iteration} - APPLYING FIXES]

[PSYCHOLOGY BLUEPRINT - PRESERVE THIS]
Friction Sentence: ${psychology.frictionSentence || 'Unknown'}
Wrong Belief: ${psychology.wrongBelief || 'Unknown'}
Feedback Loop: ${psychology.feedbackLoop || 'Unknown'}
Voice Fingerprint: ${JSON.stringify(psychology.voiceFingerprint) || 'Unknown'}

[CRITIQUE - FIX THESE ISSUES]
Score: ${critique.score}/100
Failed Gates:
${critique.gates.filter(g => !g.passed).map(g => `- ${g.id}: ${g.finding}\n  Fix: ${g.fix}`).join('\n')}

[FIX PRIORITIES - HIGHEST FIRST]
${critique.fixes.slice(0, 5).map((f, i) => `${i + 1}. [Priority ${f.priority}] ${f.section}: ${f.instruction}`).join('\n')}

[CURRENT CARD - REVISE THIS]
${cardContent}

Apply fixes surgically. Preserve what works. Output complete revised card only.`;

  const { 
    model, 
    apiFormat, 
    providerUrl, 
    apiKey, 
    temperature, 
    topP, 
    maxTokens 
  } = inputs;

  let fixedContent;
  
  try {
    switch (apiFormat) {
      case 'gemini':
        fixedContent = await _callGeminiForFix(providerUrl, apiKey, model,
          FIX_ITERATION_PROMPT, fixContext, { temperature, topP, maxTokens }, signal);
        break;
      case 'claude':
        fixedContent = await _callClaudeForFix(providerUrl, apiKey, model,
          FIX_ITERATION_PROMPT, fixContext, { temperature, topP, maxTokens }, signal);
        break;
      default:
        fixedContent = await _callOpenAIForFix(providerUrl, apiKey, model,
          FIX_ITERATION_PROMPT, fixContext, { temperature, topP, maxTokens }, signal);
    }
  } catch (error) {
    console.error('Fix iteration failed:', error);
    // Return original content if fix fails
    return {
      content: cardContent,
      changes: [],
      _metadata: {
        step: 'fix',
        timestamp: Date.now(),
        iteration,
        error: error.message,
        fallback: true
      }
    };
  }

  // Track what changed (simplified)
  const changes = critique.fixes.slice(0, 5).map(f => ({
    type: f.section,
    description: f.instruction
  }));

  return {
    content: fixedContent,
    changes,
    _metadata: {
      step: 'fix',
      timestamp: Date.now(),
      iteration,
      fixesApplied: changes.length
    }
  };
}

async function _callGeminiForFix(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${key}`;
  
  const body = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: userMessage }] 
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: (params.temperature || 0.7) - 0.2, // More focused for fixes
      maxOutputTokens: params.maxTokens || 8192,
      topP: params.topP || 0.95
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

async function _callClaudeForFix(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';

  const body = {
    model,
    max_tokens: params.maxTokens || 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
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

async function _callOpenAIForFix(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: (params.temperature || 0.7) - 0.2,
    max_tokens: params.maxTokens || 8192,
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
