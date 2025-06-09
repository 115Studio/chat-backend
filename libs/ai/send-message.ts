import { AiModel } from '../constants/ai-model'
import { AiProvider } from '../constants/ai-provider'
import { EventEnvironment } from '../../environment'
import { modelToProvider } from './model-to-provider'
import { anthropic } from './providers/anthropic'
import { google } from './providers/google'
import { openai } from './providers/openai'

export interface AiMessageContent {

}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const sendMessage = async (
  env: EventEnvironment,
  model: AiModel,
  messages: AiMessage[],
): Promise<ReadableStream | null> => {
  const provider = modelToProvider(model)

  switch (provider) {
    case AiProvider.Anthropic:
      return anthropic(env.ANTHROPIC_AUTH, model, messages)

    case AiProvider.GoogleAiStudio:
      return google(env.GOOGLE_AI_AUTH, model, messages)

    case AiProvider.OpenAi:
      return openai(env.OPENAI_AUTH, model, messages)

    default:
    case AiProvider.UnknownToGoogleAi:
      return google(env.GOOGLE_AI_AUTH, AiModel.GoogleGemini20Flash, messages)
  }
}
