// reasoning/mapping.js - Step 2: Psychology Mapping
// Synthesizes visual analysis and contradiction brainstorm into a unified psychology blueprint

const PSYCHOLOGY_MAPPING_PROMPT = `You are a character psychology architect.

TASK: Synthesize visual analysis and contradiction options into a unified, coherent psychology blueprint that will govern the entire character card.

INPUT DATA:
- Visual traits and expression details
- 3-5 contradiction options with visual roots
- Recommended primary contradiction

OUTPUT FORMAT - Return ONLY a JSON object:

{
  "psychologyBlueprint": {
    "predictableType": "The cliché this character appears to be",
    "contradiction": {
      "surface": "What they appear to be",
      "reality": "What they actually are",
      "visualEvidence": "Specific detail that grounds this",
      "asEngine": "One sentence: how this drives all behavior"
    },
    "frictionArchitecture": {
      "frictionSentence": "This character cannot get what they want because ___",
      "wrongBelief": "COMPARTMENTALIZATION | EXCEPTIONALISM | PERFORMANCE | CONTROL | DEBT",
      "wrongBeliefEmbedded": "How this shows in behavior without being stated",
      "feedbackLoop": "PROXIMITY/AVOIDANCE | PERFORMANCE/EXPOSURE | CONTROL/COLLAPSE | DENIAL/PROOF | SACRIFICE/RESENTMENT",
      "loopDemonstration": "Specific behavior cycle showing the loop",
      "frictionVisibility": "INVISIBLE | VISIBLE BUT DENIED | VISIBLE AND ACKNOWLEDGED"
    },
    "intimacyCoherence": {
      "anchor": "This character's friction looks like ___ in a sexual context",
      "surrenderInversion": "How their usual dynamic inverts in intimacy",
      "fear": "What terrifies them about closeness",
      "need": "What they need but cannot name"
    },
    "voiceFingerprint": {
      "sentenceRhythm": "Pattern description + one pure example",
      "vocabularyDomain": "technical/physical/emotional/abstract/sensory + metaphor source",
      "signatureWord": "One word only this character would use",
      "deflectionPattern": "How they avoid what they won't say",
      "physicalTell": {
        "trigger": "Emotional state that triggers it",
        "behavior": "Observable action",
        "characterAwareness": "none | partial | denied"
      }
    },
    "backstoryAnchors": {
      "anchor1_location": "Place they return to - sensory, specific",
      "anchor2_relationship": "Active relationship, what it reveals about them",
      "anchor3_loss": "Object, worn, cannot use or discard",
      "anchor4_tension": "Ongoing, unresolved before {{user}}"
    },
    "worldContext": {
      "values": "What this world values",
      "punishes": "What it punishes",
      "survivalRequires": "What survival demands",
      "sensoryDetail": "One detail only this character notices"
    }
  },
  "qualityGates": {
    "contradictionGrounded": true/false,
    "frictionSentenceGoverns": true/false,
    "loopIsCyclic": true/false,
    "voiceIsIdentifiable": true/false,
    "anchorsAreSpecific": true/false
  },
  "gatesExplanation": "Brief explanation of any false gates"
}

SYNTHESIS RULES:
1. CHOOSE the strongest contradiction that visual evidence supports
2. VERIFY the friction sentence governs ALL major sections
3. ENSURE the feedback loop can be shown cycling in dialogue
4. MAKE voice fingerprint specific enough to identify character without tags
5. ANCHOR backstory in sensory specifics, not abstractions
6. TEST: Would this psychology produce different dialogue than any other character?

If input contradictions are weak, strengthen them. If visual evidence is thin, make conservative inferences. Never proceed with vague psychology.`;

async function runPsychologyMapping(inputs, signal) {
  const { 
    visualAnalysis, 
    contradictions, 
    originalInputs 
  } = inputs;
  
  const { model, apiFormat, providerUrl, apiKey, temperature, topP } = originalInputs;

  // Build context-rich message
  const contextBlock = `
VISUAL ANALYSIS:
${JSON.stringify(visualAnalysis, null, 2)}

CONTRADICTION OPTIONS:
${JSON.stringify(contradictions, null, 2)}

PRIMARY RECOMMENDATION: ${contradictions.recommendation?.primaryContradictionId || 'c1'}
`;

  const userMessage = `Synthesize this visual analysis and contradiction brainstorm into a unified psychology blueprint.

${contextBlock}

Create a coherent psychology that:
1. Selects and strengthens the best contradiction
2. Builds friction architecture with working feedback loop
3. Defines a specific, identifiable voice fingerprint
4. Creates sensory-grounded backstory anchors
5. Establishes intimacy coherence anchor

Return JSON only.`;

  let response;
  
  try {
    switch (apiFormat) {
      case 'gemini':
        response = await _callGeminiForMapping(providerUrl, apiKey, model,
          PSYCHOLOGY_MAPPING_PROMPT, userMessage, { temperature, topP }, signal);
        break;
      case 'claude':
        response = await _callClaudeForMapping(providerUrl, apiKey, model,
          PSYCHOLOGY_MAPPING_PROMPT, userMessage, { temperature, topP }, signal);
        break;
      default:
        response = await _callOpenAIForMapping(providerUrl, apiKey, model,
          PSYCHOLOGY_MAPPING_PROMPT, userMessage, { temperature, topP }, signal);
    }
  } catch (error) {
    console.error('Psychology mapping failed:', error);
    return _createFallbackMapping(visualAnalysis, contradictions);
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
    console.error('Failed to parse mapping JSON:', parseError);
    parsed = _extractMappingFromRaw(response, visualAnalysis, contradictions);
  }

  // Validate and add metadata
  const result = {
    ...parsed.psychologyBlueprint,
    qualityGates: parsed.qualityGates || _defaultQualityGates(),
    gatesExplanation: parsed.gatesExplanation || '',
    _metadata: {
      step: 'mapping',
      timestamp: Date.now(),
      modelUsed: model,
      gatesPassed: Object.values(parsed.qualityGates || {}).filter(v => v === true).length
    }
  };

  // Derive convenience accessors
  result.frictionSentence = result.frictionArchitecture?.frictionSentence;
  result.intimacyCoherenceAnchor = result.intimacyCoherence?.anchor;
  result.wrongBelief = result.frictionArchitecture?.wrongBelief;
  result.feedbackLoop = result.frictionArchitecture?.feedbackLoop;

  return result;
}

async function _callGeminiForMapping(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${key}`;
  
  const body = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: userMessage }] 
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: params.temperature || 0.5,
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

async function _callClaudeForMapping(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';

  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: params.temperature || 0.5,
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

async function _callOpenAIForMapping(baseUrl, key, model, systemPrompt, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: params.temperature || 0.5,
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

function _createFallbackMapping(visualAnalysis, contradictions) {
  const primaryContradiction = contradictions.contradictions?.[0] || {};
  
  return {
    predictableType: primaryContradiction.predictable || 'Unknown archetype',
    contradiction: {
      surface: primaryContradiction.predictable || 'Surface presentation',
      reality: primaryContradiction.subversion || 'Hidden reality',
      visualEvidence: primaryContradiction.visualRoot || 'Visual detail',
      asEngine: primaryContradiction.asEngine || 'How this drives behavior'
    },
    frictionArchitecture: {
      frictionSentence: primaryContradiction.frictionSentence || 'This character cannot get what they want because...',
      wrongBelief: primaryContradiction.wrongBelief || 'PERFORMANCE',
      wrongBeliefEmbedded: 'Shows in their constant need to prove capability',
      feedbackLoop: primaryContradiction.feedbackLoop || 'PERFORMANCE/EXPOSURE',
      loopDemonstration: 'They take on challenges to prove worth, attract scrutiny, perform harder',
      frictionVisibility: 'VISIBLE BUT DENIED'
    },
    intimacyCoherence: {
      anchor: primaryContradiction.eroticImplication || 'Intimacy threatens their control',
      surrenderInversion: 'In intimacy, their usual dominance becomes vulnerability',
      fear: 'Being truly seen without performance',
      need: 'To be accepted without earning it'
    },
    voiceFingerprint: {
      sentenceRhythm: 'Moderate length, controlled pace. "I have considered every possibility."',
      vocabularyDomain: 'technical/architectural',
      signatureWord: 'calculated',
      deflectionPattern: 'Answer questions with precision to avoid revealing uncertainty',
      physicalTell: {
        trigger: 'Feeling exposed or questioned',
        behavior: 'Adjusts clothing or checks appearance',
        characterAwareness: 'none'
      }
    },
    backstoryAnchors: {
      anchor1_location: 'A place with specific sensory details',
      anchor2_relationship: 'Someone who sees through the performance',
      anchor3_loss: 'An object representing abandoned authenticity',
      anchor4_tension: 'Ongoing pressure to maintain image'
    },
    worldContext: {
      values: 'Appearance and capability',
      punishes: 'Vulnerability and uncertainty',
      survivalRequires: 'Constant performance',
      sensoryDetail: 'Specific to this character'
    },
    qualityGates: _defaultQualityGates(),
    gatesExplanation: 'Fallback mapping - manual review recommended',
    _metadata: {
      step: 'mapping',
      timestamp: Date.now(),
      fallback: true
    }
  };
}

function _extractMappingFromRaw(text, visualAnalysis, contradictions) {
  // Try to extract structured data from unstructured response
  const frictionMatch = text.match(/friction[^:]*:\s*["']?([^"'\n]+)["']?/i);
  const beliefMatch = text.match(/(COMPARTMENTALIZATION|EXCEPTIONALISM|PERFORMANCE|CONTROL|DEBT)/i);
  const loopMatch = text.match(/(PROXIMITY|PERFORMANCE|CONTROL|DENIAL|SACRIFICE)/i);
  
  const base = _createFallbackMapping(visualAnalysis, contradictions);
  
  if (frictionMatch) {
    base.frictionArchitecture.frictionSentence = frictionMatch[1].trim();
  }
  if (beliefMatch) {
    base.frictionArchitecture.wrongBelief = beliefMatch[1];
  }
  if (loopMatch) {
    base.frictionArchitecture.feedbackLoop = loopMatch[1];
  }
  
  return base;
}

function _defaultQualityGates() {
  return {
    contradictionGrounded: false,
    frictionSentenceGoverns: false,
    loopIsCyclic: false,
    voiceIsIdentifiable: false,
    anchorsAreSpecific: false
  };
}
