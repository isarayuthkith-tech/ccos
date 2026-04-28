// reasoning/contradiction.js - Step 1b: Contradiction Brainstorm
// Explores multiple contradiction possibilities in parallel with the visual analysis

const CONTRADICTION_BRAINSTORM_PROMPT = `You are a contradiction discovery engine for character psychology.

TASK: Given visual information about a character, brainstorm 3-5 potential psychological contradictions that would make this character compelling and specific.

A strong contradiction:
- SUBVERTS the predictable archetype suggested by appearance
- ROOTS in a specific visual detail from the image
- FUNCTIONS as an engine for the character's behavior (not a bolt-on quirk)
- CREATES ongoing friction (not a resolved backstory element)

OUTPUT FORMAT - Return ONLY a JSON object:

{
  "predictableType": "What cliché/archetype would a lazy author write?",
  "contradictions": [
    {
      "id": "c1",
      "name": "Short name for this contradiction",
      "predictable": "The cliché expectation",
      "subversion": "What actually is true (the contradiction)",
      "visualRoot": "Specific visual detail that grounds this",
      "asEngine": "One sentence: how this drives their behavior",
      "frictionSentence": "This character cannot get what they want because ___",
      "wrongBelief": "What they believe that isn't true (COMPARTMENTALIZATION/EXCEPTIONALISM/PERFORMANCE/CONTROL/DEBT)",
      "feedbackLoop": "How the contradiction cycles (PROXIMITY/AVOIDANCE, PERFORMANCE/EXPOSURE, etc.)",
      "strength": "strong/moderate/weak - how compelling is this?",
      "eroticImplication": "How this friction manifests in intimate contexts"
    }
  ],
  "recommendation": {
    "primaryContradictionId": "which contradiction to use",
    "reasoning": "why this one",
    "intimacyCoherenceAnchor": "This character's friction looks like ___ in a sexual context"
  }
}

BRAINSTORM RULES:
1. EXPLORE variety - personality vs appearance, desire vs ability, past vs present, etc.
2. VISUAL ANCHOR each contradiction to something observable
3. TEST each: would this still drive behavior 6 months into a relationship?
4. AVOID resolved trauma - contradictions should create ongoing tension
5. INCLUDE at least one contradiction that challenges gender/archetype expectations`;

async function runContradictionBrainstorm(inputs, signal) {
  const { visualAnalysis, model, apiFormat, providerUrl, apiKey, temperature, topP } = inputs;
  
  // Now works from visualAnalysis text instead of raw images (eliminates double upload)
  if (!visualAnalysis) {
    throw new Error('No visualAnalysis provided for contradiction brainstorm');
  }

  // Build text-based prompt from visual analysis
  const pt = visualAnalysis.physicalTraits || {};
  const cl = visualAnalysis.clothing || {};
  const ex = visualAnalysis.expression || {};
  const at = visualAnalysis.atmosphere || {};
  const ip = visualAnalysis.inferredPersonality || {};
  const ch = visualAnalysis.contradictionHints || {};
  
  const userMessage = `Brainstorm psychological contradictions for this character based on visual analysis.

[VISUAL ANALYSIS PROVIDED]
Physical Traits: ${pt.bodyType || 'Unknown'} body, ${pt.face || 'Unknown'} face, ${pt.hair || 'Unknown'} hair, ${pt.skin || 'Unknown'} skin
Distinguishing Features: ${(pt.distinguishingFeatures || []).join(', ') || 'None noted'}
Clothing: ${cl.description || 'Not specified'} (fabric: ${cl.fabric || 'unknown'}, fit: ${cl.fit || 'unknown'}, wear: ${cl.wearPatterns || 'unknown'})
Expression: ${ex.projectedEmotion || 'Unknown'} - ${ex.impliedTension || 'No tension noted'} (body language: ${ex.bodyLanguage || 'unknown'})
Atmosphere: ${at.lighting || 'Unknown'} lighting, ${at.mood || 'Unknown'} mood
Inferred Personality: ${(ip.possibleTraits || []).join(', ') || 'None specified'} (confidence: ${ip.confidenceLevel || 'unknown'})
Archetype Temptation: ${ip.archetypeTemptation || 'None identified'}
Subversion Opportunities: ${(ip.subversionOpportunities || []).join(', ') || 'None noted'}
Visual Contradictions: ${(ch.visual || []).join('; ') || 'None noted'}
Expression vs Attire: ${(ch.expressionVsAttire || []).join('; ') || 'None noted'}
Setting vs Subject: ${(ch.settingVsSubject || []).join('; ') || 'None noted'}

Brainstorm contradictions that:
- Subvert the obvious archetype suggested by these traits
- Root in specific visual details provided above
- Create ongoing friction (not resolved backstory)
- Function as engines for behavior

Return JSON with 3-5 contradiction options.`;

  let response;
  
  try {
    switch (apiFormat) {
      case 'gemini':
        response = await _callGeminiForContradiction(providerUrl, apiKey, model,
          CONTRADICTION_BRAINSTORM_PROMPT, userMessage, { temperature, topP }, signal);
        break;
      case 'claude':
        response = await _callClaudeForContradiction(providerUrl, apiKey, model,
          CONTRADICTION_BRAINSTORM_PROMPT, userMessage, { temperature, topP }, signal);
        break;
      default:
        response = await _callOpenAIForContradiction(providerUrl, apiKey, model,
          CONTRADICTION_BRAINSTORM_PROMPT, userMessage, { temperature, topP }, signal);
    }
  } catch (error) {
    console.error('Contradiction brainstorm failed:', error);
    return _createFallbackContradiction();
  }

  // Parse JSON from response
  let parsed;
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                      response.match(/```\s*([\s\S]*?)```/) ||
                      response.match(/\{[\s\S]*\}/);
    
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse contradiction JSON:', parseError);
    parsed = _extractContradictionsFromRaw(response);
  }

  // Validate and normalize
  if (!parsed.contradictions || !Array.isArray(parsed.contradictions)) {
    parsed.contradictions = parsed.contradictions ? [parsed.contradictions] : [];
  }

  // Ensure at least one contradiction exists
  if (parsed.contradictions.length === 0) {
    parsed.contradictions = [_createSingleFallbackContradiction()];
  }

  // Add metadata
  return {
    ...parsed,
    _metadata: {
      step: 'contradiction',
      timestamp: Date.now(),
      contradictionCount: parsed.contradictions.length,
      modelUsed: model
    }
  };
}

async function _callGeminiForContradiction(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${key}`;
  
  const parts = [{ text: userMessage }];

  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: (params.temperature || 0.7) + 0.1, // Slightly higher for creativity
      maxOutputTokens: 3072,
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

async function _callClaudeForContradiction(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';

  const content = [{ type: 'text', text: userMessage }];

  const body = {
    model,
    max_tokens: 3072,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
    temperature: (params.temperature || 0.7) + 0.1,
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

async function _callOpenAIForContradiction(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: (params.temperature || 0.7) + 0.1,
    max_tokens: 3072,
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

function _createFallbackContradiction() {
  return {
    predictableType: 'Confident, self-assured character',
    contradictions: [
      _createSingleFallbackContradiction()
    ],
    recommendation: {
      primaryContradictionId: 'c1',
      reasoning: 'Default fallback - manual review needed',
      intimacyCoherenceAnchor: 'Unable to determine from fallback'
    },
    _metadata: {
      step: 'contradiction',
      timestamp: Date.now(),
      fallback: true
    }
  };
}

function _createSingleFallbackContradiction() {
  return {
    id: 'c1',
    name: 'Mask of Confidence',
    predictable: 'They are confident and in control',
    subversion: 'They are deeply uncertain and compensate through performance',
    visualRoot: 'Expression that suggests forced composure',
    asEngine: 'Their need to appear capable drives them to take on too much, then hide their struggles',
    frictionSentence: 'This character cannot get what they want because they believe asking reveals weakness',
    wrongBelief: 'PERFORMANCE AS PROTECTION',
    feedbackLoop: 'PERFORMANCE/EXPOSURE: performs → scrutiny → threat of exposure → harder performance',
    strength: 'moderate',
    eroticImplication: 'Intimacy threatens their performance - vulnerability feels like exposure'
  };
}

function _extractContradictionsFromRaw(text) {
  // Try to extract contradiction data from unstructured text
  const contradictions = [];
  
  // Look for patterns like "Contradiction 1", "Option A", etc.
  const sections = text.split(/(?:contradiction|option)\s*\d+[:.\s]/i).filter(s => s.trim());
  
  sections.forEach((section, idx) => {
    const predictable = section.match(/predictable|clich[eé]|archetype[^:]*:\s*([^\n]+)/i);
    const subversion = section.match(/subver[sion]|actually|instead[^:]*:\s*([^\n]+)/i);
    const friction = section.match(/friction|cannot get[^:]*:\s*([^\n]+)/i);
    
    if (predictable || subversion) {
      contradictions.push({
        id: `c${idx + 1}`,
        name: `Extracted Contradiction ${idx + 1}`,
        predictable: predictable ? predictable[1].trim() : 'Unknown',
        subversion: subversion ? subversion[1].trim() : 'Unknown',
        visualRoot: 'Extracted from unstructured text',
        asEngine: friction ? friction[1].trim() : 'Unknown',
        frictionSentence: friction ? friction[1].trim() : 'Unknown',
        wrongBelief: 'Unknown',
        feedbackLoop: 'Unknown',
        strength: 'moderate',
        eroticImplication: 'Unknown'
      });
    }
  });

  return contradictions.length > 0 ? { contradictions } : _createFallbackContradiction();
}
