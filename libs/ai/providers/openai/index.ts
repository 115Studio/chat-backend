import { ModelSettings } from '../../../db/schema'
import { AiMessage } from '../../message-to-ai'
import { makeTextError } from '../../../utils/make-error'
import { ErrorCode } from '../../../constants/errors'
import { text } from './tools'

export const openai = async (
  model: ModelSettings,
  messages: AiMessage[],
) => {
  if (!model.key) {
    console.error(makeTextError(ErrorCode.ProviderAuthMissing))
    return null
  }

  // TODO check if model supports all needed features

  // TODO add openai's ids
  return text(model, messages)
}
