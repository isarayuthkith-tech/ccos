// reasoning/pipeline.js - Parallel-Optimized Multi-Step Reasoning Pipeline
// Architecture: Parallel where possible, with state management and progress tracking

var REASONING_CONFIG = {
  enabled: true,
  mode: 'parallel', // 'sequential' | 'parallel'
  maxCritiqueIterations: 3,
  useSemanticGates: true,
  scoringVersion: 'v2',
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

var PIPELINE_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
};

class ReasoningPipeline {
  constructor(config = {}) {
    this.config = { ...REASONING_CONFIG, ...config };
    this.state = PIPELINE_STATE.IDLE;
    this.currentStep = null;
    this.parallelProgress = {};
    this.results = {};
    this.errors = [];
    this.abortController = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.onStream = null; // For streaming generation output
  }

  setProgressCallback(cb) {
    this.onProgress = cb;
  }

  setCompleteCallback(cb) {
    this.onComplete = cb;
  }

  setErrorCallback(cb) {
    this.onError = cb;
  }

  setStreamCallback(cb) {
    this.onStream = cb;
  }

  _reportProgress(step, status, detail = '') {
    this.parallelProgress[step] = { status, detail, timestamp: Date.now() };
    if (this.onProgress) {
      this.onProgress({ step, status, detail, progress: this.parallelProgress });
    }
  }

  async run(inputs) {
    if (this.state === PIPELINE_STATE.RUNNING) {
      throw new Error('Pipeline already running');
    }

    this.state = PIPELINE_STATE.RUNNING;
    this.abortController = new AbortController();
    this.results = {};
    this.errors = [];
    this.parallelProgress = {};

    try {
      const startTime = Date.now();
      
      // STEP 1 SEQUENTIAL: Visual Analysis → Contradiction Brainstorm
      // Sequential eliminates image double-upload; contradiction works from analysis text
      this._reportProgress('phase1', 'running', 'Starting visual analysis...');
      
      const analysisResult = await this._runWithTimeout('analysis', 
        () => runVisualAnalysis(inputs, this.abortController.signal)
      );
      
      this.results.analysis = analysisResult;
      this._reportProgress('analysis', 'completed', `Found ${analysisResult.traits?.length || 0} traits`);
      
      // Pass visual analysis to contradiction step (no image re-upload)
      this._reportProgress('contradiction', 'running', 'Brainstorming contradictions from analysis...');
      
      const contradictionResult = await this._runWithTimeout('contradiction', 
        () => runContradictionBrainstorm({
          ...inputs,
          visualAnalysis: analysisResult  // Pass text analysis instead of images
        }, this.abortController.signal)
      );
      
      this.results.contradiction = contradictionResult;
      this._reportProgress('contradiction', 'completed', `Brainstormed ${contradictionResult.contradictions?.length || 0} contradictions`);

      // STEP 2: Psychology Mapping (combines analysis + contradiction)
      this._reportProgress('mapping', 'running', 'Synthesizing psychology blueprint...');
      
      const mappingInput = {
        visualAnalysis: analysisResult,
        contradictions: contradictionResult,
        originalInputs: inputs
      };
      
      const mappingResult = await this._runWithTimeout('mapping', 
        () => runPsychologyMapping(mappingInput, this.abortController.signal)
      );
      
      this.results.mapping = mappingResult;
      this._reportProgress('mapping', 'completed', `Friction: "${mappingResult.frictionSentence?.substring(0, 50)}..."`);

      // STEP 3: Card Generation
      this._reportProgress('generation', 'running', 'Generating character card...');
      
      // Check token budget before generation
      this._checkTokenBudget('generation', inputs.maxTokens || 8192, 8000);
      
      const generationInput = {
        psychology: mappingResult,
        visualAnalysis: analysisResult,
        originalInputs: inputs
      };
      
      // Stream callback accumulates content for UI
      let streamedContent = '';
      const onStreamChunk = (chunk) => {
        streamedContent += chunk;
        if (this.onStream) {
          this.onStream(chunk, streamedContent);
        }
      };
      
      let cardResult = await this._runWithTimeout('generation',
        () => runCardGeneration(generationInput, this.abortController.signal, onStreamChunk)
      );
      
      this.results.generation = cardResult;
      this._reportProgress('generation', 'completed', `${cardResult.content?.length || 0} chars generated`);

      // STEP 4+5: Critique → Fix iteration loop
      let iteration = 0;
      let currentCard = cardResult.content;
      let critiqueResult = null;
      
      while (iteration < this.config.maxCritiqueIterations) {
        // Check for abort before each iteration
        if (this.abortController?.signal?.aborted) {
          throw new Error('AbortError');
        }
        
        iteration++;
        this._reportProgress('critique', 'running', `Iteration ${iteration}: Running semantic critique...`);
        
        critiqueResult = await this._runWithTimeout('critique',
          () => runSemanticCritique({
            cardContent: currentCard,
            psychology: mappingResult,
            iteration: iteration,
            // Pass API credentials for potential LLM fallback on borderline cases
            apiFormat: inputs.apiFormat,
            providerUrl: inputs.providerUrl,
            apiKey: inputs.apiKey,
            model: inputs.model,
            temperature: inputs.temperature,
            topP: inputs.topP
          }, this.abortController.signal)
        );
        
        this.results[`critique_${iteration}`] = critiqueResult;
        
        const passedGates = critiqueResult.gates?.filter(g => g.passed).length || 0;
        const totalGates = critiqueResult.gates?.length || 1;
        
        this._reportProgress('critique', 'completed', 
          `Iteration ${iteration}: ${passedGates}/${totalGates} gates passed, score: ${critiqueResult.score || 0}`);

        // Check if we've achieved target quality
        if (critiqueResult.meetsThreshold && !critiqueResult.requiresFix) {
          this._reportProgress('fix', 'skipped', 'Quality threshold met, no fixes needed');
          break;
        }

        if (iteration >= this.config.maxCritiqueIterations) {
          this._reportProgress('fix', 'max_iterations', 'Maximum iterations reached');
          break;
        }

        // STEP 5: Apply fixes
        this._reportProgress('fix', 'running', `Iteration ${iteration}: Applying fixes...`);
        
        const fixResult = await this._runWithTimeout('fix',
          () => runFixIteration({
            cardContent: currentCard,
            critique: critiqueResult,
            psychology: mappingResult,
            iteration: iteration
          }, this.abortController.signal)
        );
        
        this.results[`fix_${iteration}`] = fixResult;
        currentCard = fixResult.content;
        
        this._reportProgress('fix', 'completed', `Iteration ${iteration}: Fixes applied`);
      }

      // Final results
      this.results.final = {
        content: currentCard,
        iterations: iteration,
        finalCritique: critiqueResult,
        totalTime: Date.now() - startTime,
        stepResults: {
          analysis: this.results.analysis,
          contradiction: this.results.contradiction,
          mapping: this.results.mapping,
          generation: this.results.generation
        }
      };

      this.state = PIPELINE_STATE.COMPLETED;
      
      if (this.onComplete) {
        this.onComplete(this.results.final);
      }

      return this.results.final;

    } catch (error) {
      this.state = PIPELINE_STATE.ERROR;
      this.errors.push({ step: this.currentStep, error: error.message, timestamp: Date.now() });
      
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }

  async _runWithTimeout(stepName, fn) {
    this.currentStep = stepName;
    const timeout = this.config.timeouts[stepName] || 60000;
    
    return Promise.race([
      fn(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Step ${stepName} timed out after ${timeout}ms`)), timeout);
      })
    ]);
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.state = PIPELINE_STATE.IDLE;
  }

  // Token budget warning: rough estimation (~4 chars per token)
  _checkTokenBudget(stepName, maxOutputTokens, promptLength) {
    const estimatedPromptTokens = Math.ceil(promptLength / 4);
    const estimatedTotalTokens = estimatedPromptTokens + maxOutputTokens;
    
    // Common model limits
    const limits = [
      { name: '4k', threshold: 4000, warn: 3500 },
      { name: '8k', threshold: 8192, warn: 7500 },
      { name: '32k', threshold: 32768, warn: 30000 },
      { name: '128k', threshold: 128000, warn: 120000 }
    ];
    
    // Find the most restrictive limit that might be exceeded
    for (const limit of limits) {
      if (estimatedTotalTokens > limit.warn && estimatedTotalTokens <= limit.threshold) {
        console.warn(`[Token Budget] Step "${stepName}" may exceed ${limit.name} model limit: ~${estimatedTotalTokens} tokens (prompt: ~${estimatedPromptTokens}, output: ${maxOutputTokens})`);
        return;
      }
    }
    
    // If exceeding all standard limits
    const highestLimit = limits[limits.length - 1];
    if (estimatedTotalTokens > highestLimit.threshold) {
      console.warn(`[Token Budget] Step "${stepName}" exceeds largest standard model limit (${highestLimit.threshold}): ~${estimatedTotalTokens} tokens. Consider reducing maxTokens.`);
    }
  }

  getState() {
    return {
      state: this.state,
      currentStep: this.currentStep,
      progress: this.parallelProgress,
      errors: this.errors
    };
  }
}

// Singleton instance for global access
var _pipelineInstance = null;

function createPipeline(config) {
  _pipelineInstance = new ReasoningPipeline(config);
  return _pipelineInstance;
}

function getPipeline() {
  if (!_pipelineInstance) {
    _pipelineInstance = new ReasoningPipeline();
  }
  return _pipelineInstance;
}

function abortPipeline() {
  if (_pipelineInstance) {
    _pipelineInstance.abort();
  }
}
