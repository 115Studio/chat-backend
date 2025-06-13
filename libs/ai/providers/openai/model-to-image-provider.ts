import { OpenAIImageModelId } from '@ai-sdk/openai/internal'
import { AiModel } from '../../../constants/ai-model'

export const modelToImageProvider = (model: AiModel): OpenAIImageModelId => {
  switch (model) {
    case AiModel.OpenaiGpt4o:
      return 'dall-e-3' // 'gpt-image-1'
    default: // TODO: dall-e
      return 'dall-e-3'
  }
}
