import { z } from 'zod';
import type { AnalysisResult, PsychologyBlueprint, CritiqueResult } from '@mytypes/index.ts';

const PhysicalTraitsSchema = z.object({
  bodyType: z.string(),
  face: z.string(),
  hair: z.string(),
  skin: z.string(),
  distinguishingFeatures: z.array(z.string()),
});

const ClothingSchema = z.object({
  description: z.string(),
  fabric: z.string(),
  fit: z.string(),
  wearPatterns: z.string(),
  psychologicalIntent: z.string(),
});

const ExpressionSchema = z.object({
  projectedEmotion: z.string(),
  impliedTension: z.string(),
  bodyLanguage: z.string(),
  arrestedMotion: z.string(),
});

const AtmosphereSchema = z.object({
  lighting: z.string(),
  mood: z.string(),
  environmentalCues: z.array(z.string()),
  compositionalFocus: z.string(),
});

const InferredPersonalitySchema = z.object({
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  possibleTraits: z.array(z.string()),
  archetypeTemptation: z.string(),
  subversionOpportunities: z.array(z.string()),
});

const ContradictionHintsSchema = z.object({
  visual: z.array(z.string()),
  expressionVsAttire: z.array(z.string()),
  settingVsSubject: z.array(z.string()),
});

export const AnalysisResultSchema = z.object({
  physicalTraits: PhysicalTraitsSchema,
  clothing: ClothingSchema,
  expression: ExpressionSchema,
  atmosphere: AtmosphereSchema,
  inferredPersonality: InferredPersonalitySchema,
  contradictionHints: ContradictionHintsSchema,
  _metadata: z.object({
    step: z.string(),
    timestamp: z.number(),
    imageCount: z.number(),
    fallback: z.boolean().optional(),
  }).optional(),
});

const ContradictionOptionSchema = z.object({
  surface: z.string(),
  reality: z.string(),
  friction: z.string(),
  visualEvidence: z.string(),
  wrongBelief: z.string(),
});

export const ContradictionResultSchema = z.object({
  contradictions: z.array(ContradictionOptionSchema),
  selected: ContradictionOptionSchema.nullable(),
  _metadata: z.object({
    step: z.string(),
    timestamp: z.number(),
  }).optional(),
});

const VoiceFingerprintSchema = z.object({
  sentenceRhythm: z.string(),
  vocabularyDomain: z.string(),
  signatureWord: z.string(),
  deflectionPattern: z.string(),
  physicalTell: z.object({
    trigger: z.string(),
    manifestation: z.string(),
  }),
});

export const PsychologyBlueprintSchema = z.object({
  predictableType: z.string(),
  contradiction: z.object({
    surface: z.string(),
    reality: z.string(),
    visualEvidence: z.string(),
    asEngine: z.string(),
  }),
  frictionArchitecture: z.object({
    frictionSentence: z.string(),
    wrongBelief: z.string(),
    wrongBeliefEmbedded: z.string(),
    feedbackLoop: z.string(),
    loopDemonstration: z.string(),
    frictionVisibility: z.string(),
  }),
  intimacyCoherence: z.object({
    anchor: z.string(),
    surrenderInversion: z.string(),
    fear: z.string(),
    need: z.string(),
  }),
  voiceFingerprint: VoiceFingerprintSchema,
  backstoryAnchors: z.object({
    anchor1_location: z.string(),
    anchor2_relationship: z.string(),
    anchor3_loss: z.string(),
    anchor4_tension: z.string(),
  }),
  worldContext: z.object({
    values: z.string(),
    punishes: z.string(),
    survivalRequires: z.string(),
    sensoryDetail: z.string(),
  }),
  _metadata: z.object({
    step: z.string(),
    timestamp: z.number(),
  }).optional(),
});

const QualityGateSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  passed: z.boolean().nullable(),
  message: z.string().optional(),
  severity: z.enum(['error', 'warning', 'info']).optional(),
});

export const CritiqueResultSchema = z.object({
  meetsThreshold: z.boolean(),
  requiresFix: z.boolean(),
  score: z.number(),
  gates: z.array(QualityGateSchema),
  semanticAnalysis: z.object({
    contradiction: z.object({
      grounded: z.boolean().nullable(),
      drivesBehavior: z.boolean().nullable(),
      evidenceQuote: z.string(),
    }),
    friction: z.object({
      sentenceMatchesContent: z.boolean().nullable(),
      visibleInPsychology: z.boolean().nullable(),
      visibleInDialogue: z.boolean().nullable(),
      visibleInIntimacy: z.boolean().nullable(),
    }),
    voice: z.object({
      identifiable: z.boolean(),
      consistentAcrossDialogue: z.boolean().nullable(),
      registers: z.array(z.string()),
      registerOverlap: z.array(z.string()),
    }),
    sections: z.object({
      appearanceGrounded: z.boolean().nullable(),
      psychologyCoherent: z.boolean().nullable(),
      anchorsSpecific: z.boolean().nullable(),
      worldLoadBearing: z.boolean().nullable(),
    }),
  }).optional(),
  bannedConstructions: z.array(z.object({
    word: z.string(),
    location: z.string(),
    severity: z.enum(['error', 'warning']),
  })).optional(),
  fixes: z.array(z.object({
    priority: z.number(),
    section: z.string(),
    instruction: z.string(),
  })).optional(),
  _metadata: z.object({
    step: z.string(),
    timestamp: z.number(),
    iteration: z.number(),
    usedLLM: z.boolean(),
    borderlineTriggered: z.boolean(),
    uncertainGatesTriggered: z.boolean(),
  }).optional(),
});

export function parseAnalysisResult(json: string): AnalysisResult {
  const jsonMatch = json.match(/```json\s*([\s\S]*?)```/) || 
                    json.match(/```\s*([\s\S]*?)```/) ||
                    json.match(/\{[\s\S]*\}/);
  
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : json;
  
  try {
    const parsed = JSON.parse(jsonStr);
    return AnalysisResultSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse analysis result: ${error}`);
  }
}

export function parsePsychologyBlueprint(json: string): PsychologyBlueprint {
  const jsonMatch = json.match(/```json\s*([\s\S]*?)```/) || 
                    json.match(/```\s*([\s\S]*?)```/) ||
                    json.match(/\{[\s\S]*\}/);
  
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : json;
  
  try {
    const parsed = JSON.parse(jsonStr);
    return PsychologyBlueprintSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse psychology blueprint: ${error}`);
  }
}

export function parseCritiqueResult(json: string): CritiqueResult {
  const jsonMatch = json.match(/```json\s*([\s\S]*?)```/) || 
                    json.match(/```\s*([\s\S]*?)```/) ||
                    json.match(/\{[\s\S]*\}/);
  
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : json;
  
  try {
    const parsed = JSON.parse(jsonStr);
    return CritiqueResultSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse critique result: ${error}`);
  }
}

export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
