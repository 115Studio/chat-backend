import { AiReturnType } from '../constants/ai-return-type'
import { AiModel } from '../constants/ai-model'
import { AiMessage, sendMessage } from './send-message'
import { EventEnvironment } from '../../environment'

export const askAi = async <R extends AiReturnType>(
  env: EventEnvironment, model: AiModel, messages: AiMessage[], returnType: AiReturnType = AiReturnType.Stream
): Promise<(R extends AiReturnType.Stream ? ReadableStream : string) | undefined> => {
  console.log('Asking AI with model:', model)

  const stream = await sendMessage(
    env,
    model,
    messages,
  )

  console.log('AI response stream:', stream)

  if (!stream) return

  switch (returnType) {
    case AiReturnType.Stream:
      return stream as any // ReadableStream
    case AiReturnType.Complete:
      const chunks: string[] = []
      const reader = stream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      console.log('Ai response:', chunks.join(''))

      return chunks.join('') as any // string
  }
}
