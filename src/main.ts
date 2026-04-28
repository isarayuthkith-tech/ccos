import {
  useConfig,
  useImageStore,
  useCircuitBreaker,
  useCostTracker,
  useAnalysisCache,
  CostTracker,
  RateLimiter,
  TokenBucket,
  DataMigration,
  createMigration,
  QualityGate,
  createQualityGate,
  type AppConfig,
  type GenerationCost,
  type RateLimitConfig,
  type MigrationResult,
  type GateResult,
  type QualityReport,
} from './core/index.ts';
import { createProvider, getProviderName, type BaseProvider } from './api/index.ts';
import { ReasoningPipeline, createPipeline } from './reasoning/index.ts';
import { ProgressTracker, CostDisplay } from './ui/index.ts';
import { debounce, throttle, requestIdleCallbackPolyfill } from './utils/debounce.ts';

console.log('C-COS Studio v2.0.0 - TypeScript Build');

const config = useConfig();
const imageStore = useImageStore();
const costTracker = useCostTracker();
const analysisCache = useAnalysisCache();

export {
  config,
  imageStore,
  costTracker,
  analysisCache,
  useConfig,
  useImageStore,
  useCircuitBreaker,
  useCostTracker,
  useAnalysisCache,
  CostTracker,
  RateLimiter,
  TokenBucket,
  DataMigration,
  createMigration,
  QualityGate,
  createQualityGate,
  createProvider,
  getProviderName,
  ReasoningPipeline,
  createPipeline,
  ProgressTracker,
  CostDisplay,
  debounce,
  throttle,
  requestIdleCallbackPolyfill,
  type AppConfig,
  type BaseProvider,
  type GenerationCost,
  type RateLimitConfig,
  type MigrationResult,
  type GateResult,
  type QualityReport,
};
