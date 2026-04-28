export interface CharacterCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes?: string;
  tags?: string[];
}

export interface ImageData {
  base64: string;
  mimeType: string;
  name: string;
  dataUrl: string;
  hash?: string;
}

export interface GenerationConfig {
  model: string;
  apiFormat: 'gemini' | 'claude' | 'openai';
  providerUrl: string;
  apiKey: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

export interface QualityGate {
  id: string;
  label: string;
  description: string;
  passed: boolean | null;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface QualityGateResult {
  meetsThreshold: boolean;
  requiresFix: boolean;
  score: number;
  gates: QualityGate[];
}

export interface VoiceFingerprint {
  sentenceRhythm: string;
  vocabularyDomain: string;
  signatureWord: string;
  deflectionPattern: string;
  physicalTell: {
    trigger: string;
    manifestation: string;
  };
}

export interface PhysicalTraits {
  bodyType: string;
  face: string;
  hair: string;
  skin: string;
  distinguishingFeatures: string[];
}

export interface Clothing {
  description: string;
  fabric: string;
  fit: string;
  wearPatterns: string;
  psychologicalIntent: string;
}

export interface Expression {
  projectedEmotion: string;
  impliedTension: string;
  bodyLanguage: string;
  arrestedMotion: string;
}

export interface Atmosphere {
  lighting: string;
  mood: string;
  environmentalCues: string[];
  compositionalFocus: string;
}

export interface InferredPersonality {
  confidenceLevel: 'high' | 'medium' | 'low';
  possibleTraits: string[];
  archetypeTemptation: string;
  subversionOpportunities: string[];
}

export interface ContradictionHints {
  visual: string[];
  expressionVsAttire: string[];
  settingVsSubject: string[];
}

export interface AnalysisResult {
  physicalTraits: PhysicalTraits;
  clothing: Clothing;
  expression: Expression;
  atmosphere: Atmosphere;
  inferredPersonality: InferredPersonality;
  contradictionHints: ContradictionHints;
  _metadata?: {
    step: string;
    timestamp: number;
    imageCount: number;
    fallback?: boolean;
  };
}

export interface ContradictionOption {
  surface: string;
  reality: string;
  friction: string;
  visualEvidence: string;
  wrongBelief: string;
}

export interface ContradictionResult {
  contradictions: ContradictionOption[];
  selected: ContradictionOption | null;
  _metadata?: {
    step: string;
    timestamp: number;
  };
}

export interface PsychologyBlueprint {
  predictableType: string;
  contradiction: {
    surface: string;
    reality: string;
    visualEvidence: string;
    asEngine: string;
  };
  frictionArchitecture: {
    frictionSentence: string;
    wrongBelief: string;
    wrongBeliefEmbedded: string;
    feedbackLoop: string;
    loopDemonstration: string;
    frictionVisibility: string;
  };
  intimacyCoherence: {
    anchor: string;
    surrenderInversion: string;
    fear: string;
    need: string;
  };
  voiceFingerprint: VoiceFingerprint;
  backstoryAnchors: {
    anchor1_location: string;
    anchor2_relationship: string;
    anchor3_loss: string;
    anchor4_tension: string;
  };
  worldContext: {
    values: string;
    punishes: string;
    survivalRequires: string;
    sensoryDetail: string;
  };
  _metadata?: {
    step: string;
    timestamp: number;
  };
}

export interface GenerationResult {
  content: string;
  _metadata?: {
    step: string;
    timestamp: number;
    modelUsed: string;
    length: number;
  };
}

export interface CritiqueResult extends QualityGateResult {
  semanticAnalysis?: {
    contradiction: {
      grounded: boolean | null;
      drivesBehavior: boolean | null;
      evidenceQuote: string;
    };
    friction: {
      sentenceMatchesContent: boolean | null;
      visibleInPsychology: boolean | null;
      visibleInDialogue: boolean | null;
      visibleInIntimacy: boolean | null;
    };
    voice: {
      identifiable: boolean;
      consistentAcrossDialogue: boolean | null;
      registers: string[];
      registerOverlap: string[];
    };
    sections: {
      appearanceGrounded: boolean | null;
      psychologyCoherent: boolean | null;
      anchorsSpecific: boolean | null;
      worldLoadBearing: boolean | null;
    };
  };
  bannedConstructions: Array<{
    word: string;
    location: string;
    severity: 'error' | 'warning';
  }>;
  fixes: Array<{
    priority: number;
    section: string;
    instruction: string;
  }>;
  _metadata?: {
    step: string;
    timestamp: number;
    iteration: number;
    usedLLM: boolean;
    borderlineTriggered: boolean;
    uncertainGatesTriggered: boolean;
  };
}

export interface FixResult {
  content: string;
  changes: string[];
  _metadata?: {
    step: string;
    timestamp: number;
    iteration: number;
  };
}

export interface FinalResult {
  content: string;
  iterations: number;
  finalCritique: CritiqueResult | null;
  totalTime: number;
  stepResults: {
    analysis: AnalysisResult;
    contradiction: ContradictionResult;
    mapping: PsychologyBlueprint;
    generation: GenerationResult;
  };
}

export interface PipelineProgress {
  step: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  detail?: string;
  timestamp?: number;
}

export type APIProvider = 'gemini' | 'claude' | 'openai';

export interface APIError extends Error {
  code?: string;
  status?: number;
  provider?: APIProvider;
  retryable?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
