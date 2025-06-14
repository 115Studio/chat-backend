import { AiModel } from '../constants/ai-model'
import { AiProvider } from '../constants/ai-provider'
import { EventEnvironment } from '../../environment'
import { modelToProvider } from './model-to-provider'
import { openai } from './providers/openai'
import { MessageStage, MessageStages, ModelSettings } from '../db/schema'
import { mergeModelAuth } from '../constants/merge-model-auth'
import { MessageStageType } from '../constants/message-stage-type'
import { snowflake } from '../utils/snowflake'
import { AiMessage } from './message-to-ai'
import { google } from './providers/google'
import { anthropic } from './providers/anthropic'
import { parseDataStreamPart } from './data-stream-parts'
import { upload } from '../utils/upload'
import { MessageStageContentType } from '../constants/message-stage-content-type'
import { jsonBytesToArrayBuffer } from '../utils/json-bytes-to-ab'

export type StreamMessageUpdate = Required<MessageStage>

export const sendMessage = async (
  env: EventEnvironment,
  model: ModelSettings,
  messages: AiMessage[],
  userId: string,
): Promise<ReadableStream<StreamMessageUpdate> | null> => {
  const provider = modelToProvider(model.id)

  let stream: ReadableStream<any> | null = null

  switch (provider) {
    case AiProvider.Anthropic:
      stream = await anthropic(mergeModelAuth(model, env.ANTHROPIC_AUTH), messages)
      break

    case AiProvider.GoogleAiStudio:
      stream = await google(mergeModelAuth(model, env.GOOGLE_AI_AUTH), messages)
      break

    case AiProvider.OpenAi:
      stream = await openai(mergeModelAuth(model, env.OPENAI_AUTH), messages)
      break

    default:
    case AiProvider.UnknownToGoogleAi:
      stream = await google(mergeModelAuth({ id: AiModel.GoogleGemini20Flash }, env.GOOGLE_AI_AUTH), messages)
      break
  }

  if (!stream) {
    console.error('No stream returned from AI provider')
    return null
  }

  // Create a new ReadableStream that transforms the input stream
  return new ReadableStream<StreamMessageUpdate>({
    async start(controller) {
      const reader = stream.getReader()
      const ids = new Map<MessageStageType, string>()
      const callIdToType = new Map<string, MessageStageType>()

      try {
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const stage = parseDataStreamPart(chunk) // This returns Required<MessageStage> except for id

          // Extract call ID from content if present
          const callIdMatch = stage.content?.value?.match(/call-id ([^:]+)/)
          const callId = callIdMatch?.[1]

          let messageType = stage.type

          if (messageType === MessageStageType.Unsupported) {
            // If the type is unsupported, we can skip this stage
            console.log('Unsupported message type encountered, skipping:', stage)
            continue
          }

          const needToParse = messageType === MessageStageType.ToBeParsed

          // Handle call-id mapping for tool-related messages
          if (callId && stage.content?.value) {
            // Check if this is an initial message with tool name
            if (stage.content.value.includes('::tool-name ')) {
              // This is the initial message with tool info, store the mapping
              callIdToType.set(callId, messageType)
            } else if (callIdToType.has(callId)) {
              // This is a subsequent message, use the previously mapped type
              messageType = callIdToType.get(callId)!
            }
          }

          // Get or create ID for this message type
          let id = ids.get(messageType)
          if (!id) {
            id = snowflake()
            ids.set(messageType, id)
          }

          if (needToParse) {
            const result = stage.content!.value!
              .split('::')
              .find(s => s.startsWith('result '))!
              .substring(6)
              .trim()

            let parsed = JSON.parse(result)
            console.log('stage', messageType, ids, callIdToType)

            switch (messageType) {
              case MessageStageType.VisionGen: {
                parsed = parsed as [ { data: object, type: 'image' | unknown } ]

                // Convert the result images to a Uint8Array and upload to cdn
                for (const image of parsed) {
                  if (image.type !== 'image') {
                    continue
                  }

                  if (image.data && typeof image.data === 'object') {
                    const ab = jsonBytesToArrayBuffer(image.data)

                    const dataOrError = await upload(env, userId, ab)

                    if (typeof dataOrError === 'string') {
                      console.error('Upload error:', dataOrError)
                      continue
                    }

                    controller.enqueue({
                      id,
                      type: messageType,
                      content: {
                        type: MessageStageContentType.Vision,
                        value: dataOrError.url
                      }
                    } as StreamMessageUpdate)
                  }
                }
              } break

              case MessageStageType.WebSearch: {
                // TODO
              } break

              case MessageStageType.AudioGen:
                // TODO
                break
            }
          } else {
            // Enqueue the transformed message - stage is already Required<MessageStage> except for id
            controller.enqueue({
              ...stage,
              id,
              type: messageType
            } as StreamMessageUpdate)
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error)
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    }
  })
}
