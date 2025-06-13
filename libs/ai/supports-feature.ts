import { AiModelFeature } from '../constants/ai-model-feature'

export const supportsFeature = (features: AiModelFeature[], feature: AiModelFeature): boolean => {
  return features.includes(feature)
}
