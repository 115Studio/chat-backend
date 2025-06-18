import { AiModel } from '../constants/ai-model'

export const modelToName = (model: AiModel): string => {
  switch (model) {
    case AiModel.OpenaiGpt4o:
      return 'ChatGPT 4o'
    case AiModel.OpenaiGptO4Mini:
      return 'ChatGPT o4 mini'
    case AiModel.OpenaiGpt4oMini:
      return 'ChatGPT 4o mini'
    case AiModel.OpenaiGpt4Turbo:
      return 'ChatGPT 4 Turbo'
    case AiModel.OpenaiGpt4:
      return 'ChatGPT 4'
    case AiModel.OpenaiGpt35Turbo:
      return 'ChatGPT 3.5 Turbo'

    case AiModel.AnthropicClaudeOpus4:
      return 'Claude Opus 4'
    case AiModel.AnthropicClaudeSonnet4:
      return 'Claude Sonnet 4'
    case AiModel.AnthropicClaudeSonnet37:
      return 'Claude 3.7 Sonnet'
    case AiModel.AnthropicClaudeSonnet35V2:
      return 'Claude 3.5 Sonnet'
    case AiModel.AnthropicClaudeSonnet35:
      return 'Claude 3.5 Sonnet'
    case AiModel.AnthropicClaudeHaiku35:
      return 'Claude 3.5 Haiku'
    case AiModel.AnthropicClaudeOpus3:
      return 'Claude 3 Opus'
    case AiModel.AnthropicClaudeHaiku3:
      return 'Claude 3 Haiku'

    case AiModel.GoogleGemini20Flash:
      return 'Gemini 2.0 Flash'
    case AiModel.GoogleGemini20FlashLite:
      return 'Gemini 2.0 Flash Lite'
    case AiModel.GoogleGemini25Flash:
      return 'Gemini 2.5 Flash'
    case AiModel.GoogleGemini15Flash:
      return 'Gemini 1.5 Flash'
    case AiModel.GoogleGeminiPro:
      return 'Gemini 1.5 Pro'

    case AiModel.GroqLlama31:
      return 'Llama 3.1 70B'
    case AiModel.GroqLlama38b:
      return 'Llama 3.1 8B'
    case AiModel.GroqMixtral:
      return 'Mixtral 8x7B'

    case AiModel.MistralSmall31:
      return 'Mistral Small 3.1'
    case AiModel.MistralLarge:
      return 'Mistral Large'
    case AiModel.MistralNemo:
      return 'Mistral Nemo'

    case AiModel.CerebrasLlama33:
      return 'Llama 3.3 70B'
    case AiModel.CerebrasLlama31:
      return 'Llama 3.1 8B'

    case AiModel.DeepseekCoder:
      return 'DeepSeek Coder'
    case AiModel.DeepseekChat:
      return 'DeepSeek Chat'

    case AiModel.PerplexityLlama31Sonar:
      return 'Llama 3.1 Sonar Large'
    case AiModel.PerplexityLlama31SonarSmall:
      return 'Llama 3.1 Sonar Small'

    case AiModel.CohereCommandR:
      return 'Command R'
    case AiModel.CohereCommandRPlus:
      return 'Command R+'

    case AiModel.WorkersAiLlama31:
      return 'Llama 3.1 8B'
    case AiModel.WorkersAiLlama33:
      return 'Llama 3.3 70B'
    case AiModel.WorkersAiLlama4Scout:
      return 'Llama 4 Scout'

    case AiModel.GrokBeta:
      return 'Grok Beta'

    default:
      return model
  }
}
