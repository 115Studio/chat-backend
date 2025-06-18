import { AiModel } from '../constants/ai-model'
import { AiProvider } from '../constants/ai-provider'

export const modelToProvider = (model: AiModel): AiProvider => {
  switch (model) {
    case AiModel.AnthropicClaudeOpus4:
    case AiModel.AnthropicClaudeSonnet4:
    case AiModel.AnthropicClaudeSonnet37:
    case AiModel.AnthropicClaudeSonnet35V2:
    case AiModel.AnthropicClaudeSonnet35:
    case AiModel.AnthropicClaudeHaiku35:
    case AiModel.AnthropicClaudeOpus3:
    case AiModel.AnthropicClaudeHaiku3:
      return AiProvider.Anthropic

    case AiModel.OpenaiGpt4o:
    case AiModel.OpenaiGptO4Mini:
    case AiModel.OpenaiGpt4oMini:
    case AiModel.OpenaiGpt4Turbo:
    case AiModel.OpenaiGpt4:
    case AiModel.OpenaiGpt35Turbo:
      return AiProvider.OpenAi

    case AiModel.GoogleGemini20Flash:
    case AiModel.GoogleGemini20FlashLite:
    case AiModel.GoogleGemini25Flash:
    case AiModel.GoogleGemini15Flash:
    case AiModel.GoogleGeminiPro:
      return AiProvider.GoogleAiStudio

    default:
      return AiProvider.UnknownToGoogleAi
  }
}
