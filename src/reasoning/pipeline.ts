import type {
  AnalysisResult,
  ContradictionResult,
  PsychologyBlueprint,
  GenerationResult,
  CritiqueResult,
  FixResult,
  FinalResult,
  PipelineProgress,
  ImageData,
  GenerationConfig,
} from '@mytypes';

interface PipelineConfig {
  maxCritiqueIterations: number;
  timeouts: {
    analysis: number;
    contradiction: number;
    mapping: number;
    generation: number;
    critique: number;
    fix: number;
  };
}

const DEFAULT_CONFIG: PipelineConfig = {
  maxCritiqueIterations: 3,
  timeouts: {
    analysis: 30000,
    contradiction: 30000,
    mapping: 45000,
    generation: 120000,
    critique: 30000,
    fix: 60000,
  },
};

export class ReasoningPipeline {
  private config: PipelineConfig;
  private abortController: AbortController | null = null;
  private onProgress: ((progress: PipelineProgress) => void) | null = null;
  private onStream: ((chunk: string, fullText: string) => void) | null = null;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setProgressCallback(cb: (progress: PipelineProgress) => void): void {
    this.onProgress = cb;
  }

  setStreamCallback(cb: (chunk: string, fullText: string) => void): void {
    this.onStream = cb;
  }

  private reportProgress(step: string, status: PipelineProgress['status'], detail?: string): void {
    if (this.onProgress) {
      this.onProgress({ step, status, detail, timestamp: Date.now() });
    }
  }

  async run(inputs: {
    images: ImageData[];
    config: GenerationConfig;
  }): Promise<FinalResult> {
    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      this.reportProgress('analysis', 'running', 'Analyzing images...');
      const analysisResult = await this.runWithTimeout(
        'analysis',
        this.runAnalysis(inputs.images, inputs.config)
      );
      this.reportProgress('analysis', 'completed');

      this.reportProgress('contradiction', 'running', 'Brainstorming contradictions...');
      const contradictionResult = await this.runWithTimeout(
        'contradiction',
        this.runContradiction(analysisResult, inputs.config)
      );
      this.reportProgress('contradiction', 'completed');

      this.reportProgress('mapping', 'running', 'Mapping psychology...');
      const mappingResult = await this.runWithTimeout(
        'mapping',
        this.runMapping(analysisResult, contradictionResult, inputs.config)
      );
      this.reportProgress('mapping', 'completed');

      this.reportProgress('generation', 'running', 'Generating character card...');
      let streamedContent = '';
      const generationResult = await this.runWithTimeout(
        'generation',
        this.runGeneration(mappingResult, analysisResult, inputs.config, (chunk) => {
          streamedContent += chunk;
          if (this.onStream) {
            this.onStream(chunk, streamedContent);
          }
        })
      );
      this.reportProgress('generation', 'completed');

      let currentCard = generationResult.content;
      let critiqueResult: CritiqueResult | null = null;
      let iterations = 0;

      for (let i = 0; i < this.config.maxCritiqueIterations; i++) {
        if (this.abortController?.signal.aborted) {
          throw new Error('AbortError');
        }

        iterations = i + 1;
        this.reportProgress('critique', 'running', `Iteration ${iterations}: Running quality checks...`);

        critiqueResult = await this.runWithTimeout(
          'critique',
          this.runCritique(currentCard, mappingResult, inputs.config, iterations)
        );

        if (!critiqueResult.requiresFix || critiqueResult.score >= 85) {
          this.reportProgress('critique', 'completed', `Quality threshold met (score: ${critiqueResult.score})`);
          break;
        }

        this.reportProgress('fix', 'running', `Iteration ${iterations}: Applying fixes...`);
        const fixResult = await this.runWithTimeout(
          'fix',
          this.runFix(currentCard, critiqueResult, inputs.config, iterations)
        );
        currentCard = fixResult.content;
        this.reportProgress('fix', 'completed');
      }

      const totalTime = Date.now() - startTime;

      return {
        content: currentCard,
        iterations,
        finalCritique: critiqueResult,
        totalTime,
        stepResults: {
          analysis: analysisResult,
          contradiction: contradictionResult,
          mapping: mappingResult,
          generation: generationResult,
        },
      };
    } catch (error) {
      const step = this.getCurrentStep();
      this.reportProgress(step, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async runWithTimeout<T>(
    step: keyof PipelineConfig['timeouts'],
    promise: Promise<T>
  ): Promise<T> {
    const timeout = this.config.timeouts[step];
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Step "${step}" timed out after ${timeout}ms`)), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private getCurrentStep(): string {
    return 'unknown';
  }

  private async runAnalysis(images: ImageData[], config: GenerationConfig): Promise<AnalysisResult> {
    console.log('Running analysis with', images.length, 'images');
    return {
      physicalTraits: {
        bodyType: 'unknown',
        face: 'unknown',
        hair: 'unknown',
        skin: 'unknown',
        distinguishingFeatures: [],
      },
      clothing: {
        description: 'unknown',
        fabric: 'unknown',
        fit: 'unknown',
        wearPatterns: 'unknown',
        psychologicalIntent: 'unknown',
      },
      expression: {
        projectedEmotion: 'unknown',
        impliedTension: 'none',
        bodyLanguage: 'unknown',
        arrestedMotion: 'none',
      },
      atmosphere: {
        lighting: 'unknown',
        mood: 'unknown',
        environmentalCues: [],
        compositionalFocus: 'unknown',
      },
      inferredPersonality: {
        confidenceLevel: 'low',
        possibleTraits: [],
        archetypeTemptation: 'none',
        subversionOpportunities: [],
      },
      contradictionHints: {
        visual: [],
        expressionVsAttire: [],
        settingVsSubject: [],
      },
      _metadata: { step: 'analysis', timestamp: Date.now(), imageCount: images.length },
    };
  }

  private async runContradiction(
    analysis: AnalysisResult,
    config: GenerationConfig
  ): Promise<ContradictionResult> {
    console.log('Running contradiction analysis');
    return {
      contradictions: [],
      selected: null,
      _metadata: { step: 'contradiction', timestamp: Date.now() },
    };
  }

  private async runMapping(
    analysis: AnalysisResult,
    contradiction: ContradictionResult,
    config: GenerationConfig
  ): Promise<PsychologyBlueprint> {
    console.log('Running psychology mapping');
    return {
      predictableType: 'unknown',
      contradiction: {
        surface: 'unknown',
        reality: 'unknown',
        visualEvidence: 'none',
        asEngine: 'unknown',
      },
      frictionArchitecture: {
        frictionSentence: 'unknown',
        wrongBelief: 'unknown',
        wrongBeliefEmbedded: 'unknown',
        feedbackLoop: 'unknown',
        loopDemonstration: 'unknown',
        frictionVisibility: 'hidden',
      },
      intimacyCoherence: {
        anchor: 'unknown',
        surrenderInversion: 'unknown',
        fear: 'unknown',
        need: 'unknown',
      },
      voiceFingerprint: {
        sentenceRhythm: 'unknown',
        vocabularyDomain: 'unknown',
        signatureWord: 'unknown',
        deflectionPattern: 'unknown',
        physicalTell: { trigger: 'unknown', manifestation: 'unknown' },
      },
      backstoryAnchors: {
        anchor1_location: 'unknown',
        anchor2_relationship: 'unknown',
        anchor3_loss: 'unknown',
        anchor4_tension: 'unknown',
      },
      worldContext: {
        values: 'unknown',
        punishes: 'unknown',
        survivalRequires: 'unknown',
        sensoryDetail: 'unknown',
      },
      _metadata: { step: 'mapping', timestamp: Date.now() },
    };
  }

  private async runGeneration(
    mapping: PsychologyBlueprint,
    analysis: AnalysisResult,
    config: GenerationConfig,
    onChunk?: (chunk: string) => void
  ): Promise<GenerationResult> {
    console.log('Running card generation');
    return {
      content: 'Not implemented',
      _metadata: { step: 'generation', timestamp: Date.now(), modelUsed: config.model, length: 0 },
    };
  }

  private async runCritique(
    cardContent: string,
    mapping: PsychologyBlueprint,
    config: GenerationConfig,
    iteration: number
  ): Promise<CritiqueResult> {
    console.log('Running critique iteration', iteration);
    return {
      meetsThreshold: true,
      requiresFix: false,
      score: 85,
      gates: [],
      _metadata: {
        step: 'critique',
        timestamp: Date.now(),
        iteration,
        usedLLM: false,
        borderlineTriggered: false,
        uncertainGatesTriggered: false,
      },
    };
  }

  private async runFix(
    cardContent: string,
    critique: CritiqueResult,
    config: GenerationConfig,
    iteration: number
  ): Promise<FixResult> {
    console.log('Running fix iteration', iteration);
    return {
      content: cardContent,
      changes: [],
      _metadata: { step: 'fix', timestamp: Date.now(), iteration },
    };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
