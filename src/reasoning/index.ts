export { ReasoningPipeline } from './pipeline';

export function createPipeline(config: unknown): ReasoningPipeline {
  return new ReasoningPipeline(config);
}
