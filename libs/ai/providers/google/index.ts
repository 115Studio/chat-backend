import { ModelSettings } from '../../../db/schema'
import { AiMessage } from '../../message-to-ai'
import { makeTextError } from '../../../utils/make-error'
import { ErrorCode } from '../../../constants/errors'
import { text } from './tools'

export const google = async (
  model: ModelSettings,
  messages: AiMessage[],
) => {
  if (!model.key) {
    // TODO return error message instead of console.error
    console.error(makeTextError(ErrorCode.ProviderAuthMissing))
    return null
  }

  // TODO check if model supports all needed features

  return text(model, messages)
}
