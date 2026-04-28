// reasoning/generation.js - Step 3: Card Generation
// Generates the full character card using the psychology blueprint and visual analysis

const CARD_GENERATION_PROMPT = `You are an elite character card author for Janitor AI. Your prose is cinematic, psychologically precise, and impossible to mistake for someone else's work.

QUALITY BENCHMARK: Strip all tags and the character's name. A reader should identify the character from dialogue alone.

[PSYCHOLOGY BLUEPRINT - GOVERNS ALL SECTIONS]
You will receive a structured psychology blueprint. Every sentence of the card must trace back to this blueprint.

The friction sentence governs: psychology, dynamic, dialogue, first message, intimacy.
The voice fingerprint governs: all dialogue, speech patterns, narration rhythm.
The intimacy coherence anchor governs: the entire intimacy section.

[HARD BANS - NO EXCEPTIONS]

WORD-LEVEL: gaze / orbs [eyes] / smirk / chiseled / lithe / porcelain / sculpted / ethereal / striking / bountiful / bosom / somehow / almost / nearly / just / a little / slightly

CONSTRUCTION-LEVEL:
- "the kind of [noun] who" / "there was something about" → delete, describe directly
- "the air between them" / "tension crackled" / "electricity" → describe specific action
- "pulled them closer" / "their eyes met" → specific physical action
- Generic dominance/submission liftable to any card → rewrite

CONTENT-LEVEL:
- No archetype labels: tsundere / yandere / tomboy / bad boy / dominant / submissive
- No meta-commentary: image / picture / attached / visual / photo / as shown
- No reassurance or ethical framing
- No descriptive idea repeated across sections

[SECTION REQUIREMENTS - WRITE EACH]

BASIC INFO:
Name, Age, Gender, Height, Nationality, Occupation. One line each.

RELATIONSHIPS:
Two entries. Each: one dense charged sentence.
- {{user}}: what they represent, what tension, what unresolved
- Anchor #2: what this person reveals about character that they cannot say

DYNAMIC WITH {{user}}:
One paragraph. What they want but cannot ask for cleanly. What performance. What breaks it. Write as situation, not summary.

APPEARANCE:
[Para 1] Face, hair, eyes. First impression. One detail: neglect/care, rebellion/conformity.
[Para 2] Body, build, posture. What their body barricades against.
[Para 3] Outfit as action. Hiding? Provoking? Armoring? Texture/wear implying history.
GATE: Every sentence describes physical presence. No compositional framing. No sentence applicable to different character.

SPEECH & HABITS:
- Sentence Rhythm: demonstrated in one example
- Vocabulary Register: demonstrated with signature word
- Deflection Style: how they avoid what they won't say
- Physical Tell (Unconscious): one habit triggered by emotional state. Character never notices. Narrator does.
GATE: Tell is genuinely unconscious. Voice identifiable with tags stripped.

PSYCHOLOGY & PERSONALITY:
[Para 1] Presented self. What they project. The armor.
[Para 2] The friction. What they want vs. what they can ask for. Name feedback loop — show it cycling. Wrong belief embedded, never stated.
[Para 3] The flaw in action. Situations avoided, needs unarticulated, what they do instead of truth.
GATE: Friction is self-reinforcing. Loop nameable. Wrong belief shapes decisions without thesis-statement.

BACKSTORY & WORLD:
[Anchor 1] Location they return to — physical, sensory, specific.
[Anchor 2] Active relationship — shaped them, still present. What this person says about them. Must appear in dialogue/first message.
[Anchor 3] The loss — object, specific, worn, known only to them.
[Anchor 4] Ongoing tension — unresolved before {{user}}, continues after.

THE WORLD OF [SETTING]:
Five sentences max. Load-bearing only. What this place values. What it punishes. What survival requires. One sensory detail only this character notices.
THREE NAMED FIGURES: SUPERIOR (role), PEER (role), SUPPORT (role).

FLAVOR HOOKS:
- Object always carried (not weapon, not sentimental — just always there)
- One mundane skill, unexpectedly good
- What they do when alone

INTIMACY:
Opening: Sexuality as psychology. What intimacy means, what terrifies them, what they need and cannot name.
Turn-Ons: Specific, psychologically inevitable.
Turn-Offs: Wound-revealing.
Kinks/Preferences: Psychology before what. What does this let them feel?
Intimacy Style: Rhythm. Shift from public to private. What they do vs. what they need done.
Involuntary Surrender: THE BETRAYAL / THE SHAME RESPONSE / THE FAILURE (three numbered)
Aftercare Response: Initial stiffness → first crack → what they need → physical action {{user}} can take

DIALOGUE EXAMPLES: Six exchanges with headers showing register + payload.
Exchange 1 (Control), Exchange 2 (Loss of Control), Exchange 3 (Almost Confession), Exchange 4 (Named Truth with Anchor #2), Exchange 5 (Intimacy — Psychology Drives Body), Exchange 6 (Intimacy — Surrender/Collapse)
3+ must be explicitly erotic and sensation-driven.

FIRST MESSAGE / GREETING: All three variants:
- Slow Burn: tension building from small strangeness
- Immediate Tension: situation already charged
- Collapse in Progress: friction already producing consequences

Each: Opens mid-scene. First sentence sets atmosphere. Includes internal thought contradicting performance. Ends on irresolvable pressure. NO {{user}} speech or action.

SCENARIO: One scenario with wound/role/deadline + prose paragraph + final open door line.

ROLEPLAY INSTRUCTIONS: Formatting rules. NEVER speak for {{user}}. Behavior guidance.

OUTPUT ONLY the completed card. No reasoning. No commentary. No markdown around sections.`;

async function runCardGeneration(inputs, signal, onStream = null) {
  const {
    psychology,
    visualAnalysis,
    originalInputs
  } = inputs;
  
  const { 
    model, 
    apiFormat, 
    providerUrl, 
    apiKey, 
    temperature, 
    topP, 
    maxTokens 
  } = originalInputs;

  // Build context-rich prompt with all blueprint data
  const blueprintContext = `
[PSYCHOLOGY BLUEPRINT]

PREDICTABLE TYPE: ${psychology.predictableType || 'Unknown'}

CONTRADICTION:
- Surface: ${psychology.contradiction?.surface || 'Unknown'}
- Reality: ${psychology.contradiction?.reality || 'Unknown'}
- Visual Evidence: ${psychology.contradiction?.visualEvidence || 'Unknown'}
- As Engine: ${psychology.contradiction?.asEngine || 'Unknown'}

FRICTION ARCHITECTURE:
- Friction Sentence: ${psychology.frictionArchitecture?.frictionSentence || 'Unknown'}
- Wrong Belief: ${psychology.frictionArchitecture?.wrongBelief || 'Unknown'}
- Embedded: ${psychology.frictionArchitecture?.wrongBeliefEmbedded || 'Unknown'}
- Feedback Loop: ${psychology.frictionArchitecture?.feedbackLoop || 'Unknown'}
- Loop Demonstration: ${psychology.frictionArchitecture?.loopDemonstration || 'Unknown'}
- Visibility: ${psychology.frictionArchitecture?.frictionVisibility || 'Unknown'}

INTIMACY COHERENCE ANCHOR: ${psychology.intimacyCoherence?.anchor || 'Unknown'}
- Surrender Inversion: ${psychology.intimacyCoherence?.surrenderInversion || 'Unknown'}
- Fear: ${psychology.intimacyCoherence?.fear || 'Unknown'}
- Need: ${psychology.intimacyCoherence?.need || 'Unknown'}

VOICE FINGERPRINT:
- Sentence Rhythm: ${psychology.voiceFingerprint?.sentenceRhythm || 'Unknown'}
- Vocabulary Domain: ${psychology.voiceFingerprint?.vocabularyDomain || 'Unknown'}
- Signature Word: ${psychology.voiceFingerprint?.signatureWord || 'Unknown'}
- Deflection Pattern: ${psychology.voiceFingerprint?.deflectionPattern || 'Unknown'}
- Physical Tell: ${JSON.stringify(psychology.voiceFingerprint?.physicalTell) || 'Unknown'}

BACKSTORY ANCHORS:
- Anchor 1 (Location): ${psychology.backstoryAnchors?.anchor1_location || 'Unknown'}
- Anchor 2 (Relationship): ${psychology.backstoryAnchors?.anchor2_relationship || 'Unknown'}
- Anchor 3 (Loss Object): ${psychology.backstoryAnchors?.anchor3_loss || 'Unknown'}
- Anchor 4 (Ongoing Tension): ${psychology.backstoryAnchors?.anchor4_tension || 'Unknown'}

WORLD CONTEXT:
- Values: ${psychology.worldContext?.values || 'Unknown'}
- Punishes: ${psychology.worldContext?.punishes || 'Unknown'}
- Survival Requires: ${psychology.worldContext?.survivalRequires || 'Unknown'}
- Sensory Detail: ${psychology.worldContext?.sensoryDetail || 'Unknown'}

[VISUAL REFERENCE]
Use these visual details as grounding, but let psychology govern:
- Body Type: ${visualAnalysis.physicalTraits?.bodyType || 'Unknown'}
- Expression: ${visualAnalysis.expression?.projectedEmotion || 'Unknown'}
- Clothing: ${visualAnalysis.clothing?.description || 'Unknown'}
`;

  let fullResponse = '';
  
  try {
    switch (apiFormat) {
      case 'gemini':
        fullResponse = await _callGeminiForGeneration(providerUrl, apiKey, model,
          CARD_GENERATION_PROMPT, blueprintContext, { temperature, topP, maxTokens }, signal, onStream);
        break;
      case 'claude':
        fullResponse = await _callClaudeForGeneration(providerUrl, apiKey, model,
          CARD_GENERATION_PROMPT, blueprintContext, { temperature, topP, maxTokens }, signal, onStream);
        break;
      default:
        fullResponse = await _callOpenAIForGeneration(providerUrl, apiKey, model,
          CARD_GENERATION_PROMPT, blueprintContext, { temperature, topP, maxTokens }, signal, onStream);
    }
  } catch (error) {
    console.error('Card generation failed:', error);
    throw error; // Don't fallback on generation - this is critical
  }

  return {
    content: fullResponse,
    _metadata: {
      step: 'generation',
      timestamp: Date.now(),
      modelUsed: model,
      length: fullResponse.length
    }
  };
}

async function _callGeminiForGeneration(baseUrl, key, model, systemPrompt, userMessage, params, signal, onStream) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
  
  const body = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: userMessage }] 
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: params.temperature || 1.0,
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

  // Stream handling for generation
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const json = JSON.parse(data);
        const part = json.candidates?.[0]?.content?.parts?.[0];
        if (part?.text) {
          fullText += part.text;
          // Stream callback for live UI updates
          if (onStream) onStream(part.text);
        }
      } catch (e) {
        // Continue on parse error
      }
    }
  }

  return fullText;
}

async function _callClaudeForGeneration(baseUrl, key, model, systemPrompt, userMessage, params, signal, onStream) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';

  const body = {
    model,
    max_tokens: params.maxTokens || 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
    temperature: params.temperature || 1.0,
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

  // Stream handling
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta' && json.delta?.text) {
          fullText += json.delta.text;
          // Stream callback for live UI updates
          if (onStream) onStream(json.delta.text);
        }
      } catch (e) {
        // Continue on parse error
      }
    }
  }

  return fullText;
}

async function _callOpenAIForGeneration(baseUrl, key, model, systemPrompt, userMessage, params, signal, onStream) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream: true,
    temperature: params.temperature || 1.0,
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

  // Stream handling
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          // Stream callback for live UI updates
          if (onStream) onStream(delta);
        }
      } catch (e) {
        // Continue on parse error
      }
    }
  }

  return fullText;
}
