import { AiModel } from '../constants/ai-model'
import { AiProvider } from '../constants/ai-provider'

export interface AiMessageContent {

}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const sendMessage = async (
  gateway: AiGateway,
  providerToken: string,
  model: AiModel,
  messages: AiMessage[],
): Promise<ReadableStream | null> => {
  console.log('Sending message to AI provider: a', 'Model:', model, 'Messages:', messages)

  const response = await gateway.run({
    provider: 'compat',
    endpoint: 'chat/completions',
    headers: {
      'Authorization': `Bearer ${providerToken}`,
    },
    query: {
      model,
      messages
    }
  })

  console.log('AI provider response:', response.status, response.statusText)

  return response.body
}
