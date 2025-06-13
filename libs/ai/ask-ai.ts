import { AiReturnType } from '../constants/ai-return-type'
import { sendMessage, StreamMessageUpdate } from './send-message'
import { EventEnvironment } from '../../environment'
import { MessageStages, ModelSettings } from '../db/schema'
import { MessageStageType } from '../constants/message-stage-type'
import { MessageStageContentType } from '../constants/message-stage-content-type'
import { AiMessage } from './message-to-ai'

export const askAi = async <R extends AiReturnType>(
  env: EventEnvironment,
  model: ModelSettings,
  messages: AiMessage[],
  returnType: AiReturnType = AiReturnType.Stream,
): Promise<(R extends AiReturnType.Stream ? ReadableStream<StreamMessageUpdate> : MessageStages) | null> => {
  console.log('Asking AI with model:', model)

  const stream = await sendMessage(
    env,
    model,
    messages,
  )

  console.log('AI response stream:', stream)

  if (!stream) return null

  switch (returnType) {
    case AiReturnType.Stream:
      return stream as any // ReadableStream<StreamMessageUpdate>
    case AiReturnType.Complete:
      const stages: MessageStages = []
      const reader = stream.getReader()
      const contentMap = new Map<string, string>()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Update the content map with the latest content for each stage ID
        contentMap.set(value.id, value.content)
      }

      // Convert the content map to message stages
      for (const [id, content] of contentMap.entries()) {
        // Skip thinking stages in final output
        if (content === 'Thinking...') continue

        stages.push({
          id,
          type: MessageStageType.Text,
          content: {
            type: MessageStageContentType.Text,
            value: content
          }
        })
      }

      console.log('AI response stages:', stages)

      return stages as any // MessageStages
  }
}
