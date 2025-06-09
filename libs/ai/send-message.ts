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

  return response.body
}
