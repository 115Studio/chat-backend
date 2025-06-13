import { StreamMessageUpdate } from '../../send-message'
import { ModelSettings } from '../../../db/schema'
import { AiMessage } from '../../message-to-ai'
import { makeTextError } from '../../../utils/make-error'
import { ErrorCode } from '../../../constants/errors'
import { supportsFeature } from '../../supports-feature'
import { modelToFeatures } from '../../model-to-features'
import { AiModelFeature } from '../../../constants/ai-model-feature'
import { createOpenAI } from '@ai-sdk/openai'
import { AiModelFlag } from '../../../constants/ai-model-flag'
import { image, text } from './tools'

export const openai = async (
  model: ModelSettings,
  messages: AiMessage[],
): Promise<ReadableStream<any> | null> => {
  if (!model.key) {
    console.error(makeTextError(ErrorCode.ProviderAuthMissing))
    return null
  }

  return text(model, messages)
}
