import { Message } from '../db/schema'
import { modelToProvider } from './model-to-provider'
import { modelToFeatures } from './model-to-features'
import { modelToName } from './model-to-name'
import { AiModelFeature } from '../constants/ai-model-feature'
import { defaultPrompt, imageGenPrompt, webSearchPrompt } from './prompt'

export const parseSystemPrompt = (message: Message, prompt: string): string => {
  const model = message.model.id
  const provider = modelToProvider(model)
  const features = modelToFeatures(model)

  const feature = (f: AiModelFeature) => features.includes(f) ? 'enabled' : 'disabled'

  return prompt
    .replace(/{{model_name}}/g, modelToName(model))
    .replace(/{{provider_name}}/g, provider)
    .replace(/{{current_date}}/g, new Date().toISOString())
    .replace(/{{image_input_capabilities}}/g, feature(AiModelFeature.Vision))
    .replace(/{{file_input_capabilities}}/g, feature(AiModelFeature.FileScan))
    .replace(/{{audio_input_capabilities}}/g, feature(AiModelFeature.AudioGen))
}

export const getSystemPrompt = (message: Message, personalityPrompt?: string): string => {
  if (personalityPrompt) return parseSystemPrompt(message, personalityPrompt)

  const features = modelToFeatures(message.model.id)

  const hasImageGen = features.includes(AiModelFeature.ImageGen)
  const hasWebSearch = features.includes(AiModelFeature.WebSearch)

  return parseSystemPrompt(message, defaultPrompt)
    + (hasImageGen ? '\n\n' + imageGenPrompt : '')
    + (hasWebSearch ? '\n\n' + webSearchPrompt : '')
}
