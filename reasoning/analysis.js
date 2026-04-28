// reasoning/analysis.js - Step 1a: Visual Analysis
// Extracts structured traits from reference images using a lightweight model

const VISUAL_ANALYSIS_PROMPT = `You are a precise visual analyst for character generation.

TASK: Analyze the provided character image(s) and extract structured visual information.

OUTPUT FORMAT - Return ONLY a JSON object with this exact structure:

{
  "physicalTraits": {
    "bodyType": "description of build and stature",
    "face": "facial features, bone structure, expression",
    "hair": "color, style, length, texture, any distinctive qualities",
    "skin": "tone, texture, any marks or features",
    "distinguishingFeatures": ["specific unique visual elements"]
  },
  "clothing": {
    "description": "overall outfit description",
    "fabric": "materials and textures visible",
    "fit": "how clothes fit the body - tight, loose, tailored, worn",
    "wearPatterns": "signs of use, age, care or neglect",
    "psychologicalIntent": "what the clothing choice suggests about the character"
  },
  "expression": {
    "projectedEmotion": "primary emotion being displayed",
    "impliedTension": "underlying tension or conflict visible",
    "bodyLanguage": "posture, gestures, stance",
    "arrestedMotion": "any sense of movement frozen in the image"
  },
  "atmosphere": {
    "lighting": "quality and direction of light",
    "mood": "overall emotional tone of the image",
    "environmentalCues": "setting elements visible or implied",
    "compositionalFocus": "what the framing emphasizes"
  },
  "inferredPersonality": {
    "confidenceLevel": "high/medium/low - how certain are these inferences?",
    "possibleTraits": ["personality traits suggested by visual evidence"],
    "archetypeTemptation": "what cliché type this character might suggest",
    "subversionOpportunities": "visual elements that could support unexpected personality"
  },
  "contradictionHints": {
    "visual": ["specific details that seem at odds with each other"],
    "expressionVsAttire": ["mismatches between what they wear and how they carry themselves"],
    "settingVsSubject": ["tensions between character and environment"]
  }
}

RULES:
1. Be SPECIFIC - not "attractive face" but "sharp cheekbones, asymmetrical smile"
2. Note AMBIGUITIES - flag unclear elements rather than guessing
3. AVOID archetype labels - describe what you see, not "tsundere", "bad boy", etc.
4. PRESERVE uncertainty - use confidence levels when inferring personality
5. FOCUS on details that root in reality - expressions, clothing wear, posture

If multiple images provided, synthesize across all of them, noting consistency and variation.`;

async function runVisualAnalysis(inputs, signal) {
  const { images, model, apiFormat, providerUrl, apiKey, temperature, topP } = inputs;
  
  if (!images || images.length === 0) {
    throw new Error('No images provided for visual analysis');
  }

  // Build message with images
  const imageParts = images.map(img => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
  }));

  const userMessage = 'Analyze this character image and return structured JSON.';

  let response;
  
  try {
    switch (apiFormat) {
      case 'gemini':
        response = await _callGeminiForAnalysis(providerUrl, apiKey, model, 
          VISUAL_ANALYSIS_PROMPT, imageParts, userMessage, { temperature, topP }, signal);
        break;
      case 'claude':
        response = await _callClaudeForAnalysis(providerUrl, apiKey, model,
          VISUAL_ANALYSIS_PROMPT, imageParts, userMessage, { temperature, topP }, signal);
        break;
      default:
        response = await _callOpenAIForAnalysis(providerUrl, apiKey, model,
          VISUAL_ANALYSIS_PROMPT, imageParts, userMessage, { temperature, topP }, signal);
    }
  } catch (error) {
    console.error('Visual analysis failed:', error);
    // Return a minimal fallback result instead of crashing
    return _createFallbackAnalysis(images);
  }

  // Parse JSON from response
  let parsed;
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                      response.match(/```\s*([\s\S]*?)```/) ||
                      response.match(/\{[\s\S]*\}/);
    
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse analysis JSON:', parseError);
    // Attempt to extract structured data from raw text
    parsed = _extractStructuredFromRaw(response);
  }

  return {
    ...parsed,
    _metadata: {
      step: 'analysis',
      timestamp: Date.now(),
      imageCount: images.length,
      modelUsed: model
    }
  };
}

async function _callGeminiForAnalysis(baseUrl, key, model, systemPrompt, imageParts, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/models/${model}:generateContent?key=${key}`;
  
  const parts = imageParts.map(img => ({
    inlineData: {
      mimeType: img.image_url.url.match(/data:([^;]+)/)[1],
      data: img.image_url.url.split(',')[1]
    }
  }));
  parts.push({ text: userMessage });

  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: params.temperature || 0.3,
      maxOutputTokens: 2048,
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

async function _callClaudeForAnalysis(baseUrl, key, model, systemPrompt, imageParts, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/messages') ? base : base + '/messages';

  const content = [
    ...imageParts.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.image_url.url.match(/data:([^;]+)/)[1],
        data: img.image_url.url.split(',')[1]
      }
    })),
    { type: 'text', text: userMessage }
  ];

  const body = {
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
    temperature: params.temperature || 0.3,
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

async function _callOpenAIForAnalysis(baseUrl, key, model, systemPrompt, imageParts, userMessage, params, signal) {
  const base = baseUrl.replace(/\/$/, '');
  const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          ...imageParts,
          { type: 'text', text: userMessage }
        ]
      }
    ],
    temperature: params.temperature || 0.3,
    max_tokens: 2048,
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

function _createFallbackAnalysis(images) {
  return {
    physicalTraits: {
      bodyType: 'Unable to determine from analysis failure',
      face: 'Analysis pending',
      hair: 'Analysis pending',
      skin: 'Analysis pending',
      distinguishingFeatures: ['Analysis failed - using fallback']
    },
    clothing: {
      description: 'Analysis pending',
      fabric: 'Analysis pending',
      fit: 'Analysis pending',
      wearPatterns: 'Analysis pending',
      psychologicalIntent: 'Analysis pending'
    },
    expression: {
      projectedEmotion: 'Unknown',
      impliedTension: 'Unknown',
      bodyLanguage: 'Unknown',
      arrestedMotion: 'Unknown'
    },
    atmosphere: {
      lighting: 'Unknown',
      mood: 'Unknown',
      environmentalCues: [],
      compositionalFocus: 'Unknown'
    },
    inferredPersonality: {
      confidenceLevel: 'low',
      possibleTraits: ['Analysis failed'],
      archetypeTemptation: 'Unknown',
      subversionOpportunities: []
    },
    contradictionHints: {
      visual: [],
      expressionVsAttire: [],
      settingVsSubject: []
    },
    _metadata: {
      step: 'analysis',
      timestamp: Date.now(),
      fallback: true,
      imageCount: images.length
    }
  };
}

function _extractStructuredFromRaw(text) {
  // Attempt to extract key information from unstructured text
  const sections = {};
  
  // Simple extraction patterns
  const patterns = {
    bodyType: /body[^:]*:\s*([^\n]+)/i,
    hair: /hair[^:]*:\s*([^\n]+)/i,
    expression: /expression[^:]*:\s*([^\n]+)/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match) sections[key] = match[1].trim();
  }

  return {
    ..._createFallbackAnalysis([]),
    ...sections,
    _extractedFromRaw: true
  };
}
