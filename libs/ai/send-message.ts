import { AiModel } from '../constants/ai-model'
import { AiProvider } from '../constants/ai-provider'
import { EventEnvironment } from '../../environment'
import { modelToProvider } from './model-to-provider'
// import { anthropic } from './providers/anthropic'
// import { google } from './providers/google'
import { openai } from './providers/openai'
import { MessageStage, MessageStages, ModelSettings } from '../db/schema'
import { mergeModelAuth } from '../constants/merge-model-auth'
import { MessageStageType } from '../constants/message-stage-type'
import { snowflake } from '../utils/snowflake'
import { AiMessage } from './message-to-ai'

export interface StreamMessageUpdate {
  type: MessageStageType;
  id: string;
  content: string;
}

export const sendMessage = async (
  env: EventEnvironment,
  model: ModelSettings,
  messages: AiMessage[],
  // @ts-ignore
): Promise<ReadableStream<StreamMessageUpdate> | null> => {
  const provider = modelToProvider(model.id)

  switch (provider) {
    case AiProvider.Anthropic:
      // return anthropic(mergeModelAuth(model, env.ANTHROPIC_AUTH), messages)

    case AiProvider.GoogleAiStudio:
      // return google(mergeModelAuth(model, env.GOOGLE_AI_AUTH), messages)

    case AiProvider.OpenAi:
      return openai(mergeModelAuth(model, env.OPENAI_AUTH), messages)

    default:
    case AiProvider.UnknownToGoogleAi:
      // return google(mergeModelAuth({ id: AiModel.GoogleGemini20Flash }, env.GOOGLE_AI_AUTH), messages)
  }
}
