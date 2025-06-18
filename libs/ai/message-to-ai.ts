import { Message as DbMessage } from '../db/schema'
import {
  AssistantContent,
  CoreAssistantMessage,
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  ImagePart,
  UserContent
} from 'ai'
import { MessageStageType } from '../constants/message-stage-type'

export type AiMessage = CoreUserMessage | CoreAssistantMessage | CoreSystemMessage

export const messageToAi = (message: DbMessage): AiMessage | undefined => {
  const content: UserContent & AssistantContent = []

  const filtered = message.stages.filter(s => !!s.content?.value)

  if (filtered.length === 0) {
    return undefined
  }

  for (const stage of filtered) {
    switch (stage.type) {
      case MessageStageType.Think:
        if (stage.content?.value) {
          content.push({
            type: 'reasoning',
            text: stage.content.value
          })
        }
        break

      case MessageStageType.Text:
        if (stage.content?.value) {
          content.push({
            type: 'text',
            text: stage.content.value
          })
        }
        break

      case MessageStageType.VisionGen:
      case MessageStageType.Vision:
        if (stage.content?.value) {
          content.push({
            type: 'image',
            image: new URL(stage.content.value)
          })
        }
        break

      case MessageStageType.Pdf:
        if (stage.content?.value) {
          content.push({
            type: 'file',
            data: stage.content.value,
            mimeType: 'application/pdf'
          })
        }
        break

      case MessageStageType.File:
        if (stage.content?.value) {
          content.push({
            type: 'file',
            data: stage.content.value,
            mimeType: 'text/plain'
          })
        }
        break

      case MessageStageType.WebSearch:
        if (stage.content?.value) {
          content.push({
            type: 'text',
            text: stage.content.value
          })
        }
        break

      case MessageStageType.Audio:
        if (stage.content?.value) {
          content.push({
            type: 'file',
            data: stage.content.value,
            mimeType: 'audio/mpeg'
          })
        }
        break
    }
  }

  if (content.length === 0) {
    return undefined
  }

  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content,
  }
}
