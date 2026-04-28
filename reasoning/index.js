// reasoning/index.js - Main exports for the reasoning pipeline module
// Parallel-Optimized Multi-Step Reasoning for C-COS

// Core pipeline
// (pipeline.js must be loaded before this file in index.html)

// Step implementations
// (analysis.js, contradiction.js, mapping.js, generation.js, critique.js, fix.js must be loaded before this file)

// Export configuration
var REASONING_DEFAULTS = {
  enabled: false, // Feature flag - enable after testing
  mode: 'parallel',
  maxCritiqueIterations: 3,
  useSemanticGates: true,
  modelTiers: {
    analysis: 'lightweight',
    contradiction: 'lightweight', 
    mapping: 'reasoning',
    generation: 'primary',
    critique: 'lightweight',
    fix: 'primary'
  },
  timeouts: {
    analysis: 30000,
    contradiction: 30000,
    mapping: 45000,
    generation: 120000,
    critique: 30000,
    fix: 60000
  }
};

// Initialize reasoning module
function initReasoning(userConfig = {}) {
  const config = { ...REASONING_DEFAULTS, ...userConfig };
  
  if (typeof ReasoningPipeline !== 'undefined') {
    return createPipeline(config);
  }
  
  console.error('ReasoningPipeline not available. Ensure pipeline.js is loaded.');
  return null;
}

// Check if reasoning is enabled
function isReasoningEnabled() {
  return state?.reasoningEnabled || REASONING_DEFAULTS.enabled;
}

// Toggle reasoning feature flag
function toggleReasoning(enabled) {
  if (typeof state !== 'undefined') {
    state.reasoningEnabled = enabled;
    saveConfig();
  }
  REASONING_DEFAULTS.enabled = enabled;
}

// Run full reasoning pipeline
async function runReasoningGeneration(inputs, callbacks = {}) {
  const pipeline = initReasoning();
  
  if (!pipeline) {
    throw new Error('Reasoning pipeline not initialized');
  }
  
  // Set up callbacks
  if (callbacks.onProgress) {
    pipeline.setProgressCallback(callbacks.onProgress);
  }
  if (callbacks.onComplete) {
    pipeline.setCompleteCallback(callbacks.onComplete);
  }
  if (callbacks.onError) {
    pipeline.setErrorCallback(callbacks.onError);
  }
  if (callbacks.onStream) {
    pipeline.setStreamCallback(callbacks.onStream);
  }
  
  // Run pipeline
  const result = await pipeline.run(inputs);
  
  return result;
}

// Export for global access
if (typeof window !== 'undefined') {
  window.REASONING_DEFAULTS = REASONING_DEFAULTS;
  window.initReasoning = initReasoning;
  window.isReasoningEnabled = isReasoningEnabled;
  window.toggleReasoning = toggleReasoning;
  window.runReasoningGeneration = runReasoningGeneration;
}
