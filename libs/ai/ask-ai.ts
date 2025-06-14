import { AiReturnType } from '../constants/ai-return-type'
import { sendMessage, StreamMessageUpdate } from './send-message'
import { EventEnvironment } from '../../environment'
import { BYOK, MessageStage, MessageStages, ModelSettings } from '../db/schema'
import { MessageStageType } from '../constants/message-stage-type'
import { AiMessage } from './message-to-ai'

export const askAi = async <R extends AiReturnType>(
  env: EventEnvironment,
  model: ModelSettings,
  messages: AiMessage[],
  userId: string,
  byoks: BYOK[] = [],
  returnType: AiReturnType = AiReturnType.Stream,
): Promise<(R extends AiReturnType.Stream ? ReadableStream<StreamMessageUpdate> : MessageStages) | null> => {
  console.log('Asking AI with model:', model)

  const stream = await sendMessage(env, model, messages, userId, byoks)

  if (!stream) return null

  switch (returnType) {
    case AiReturnType.Stream:
      return stream as any // ReadableStream<StreamMessageUpdate>

    case AiReturnType.Complete:
      const reader = stream.getReader()
      const stages = new Map<string, MessageStage>()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if (!value) continue

        let stage = stages.get(value.id)

        if (!stage) {
          stage = value
          stages.set(value.id, stage)
        }

        switch (stage.type) {
          case MessageStageType.Text:
          case MessageStageType.Think:
            if (!value.content.value) continue

            if (stage.content) {
              stage.content.value += value.content.value
            } else {
              stage.content = value.content
            }
            break
          default:
            stage.content = value.content
        }
      }

      return Array.from(stages.values()) as any // MessageStages
  }
}
