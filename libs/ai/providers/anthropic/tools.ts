import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { ModelSettings } from '../../../db/schema'
import { AiMessage } from '../../message-to-ai'
import { AiToolName } from '../../../constants/ai-tool-name'
import { AiResponse } from '../../ai-response'
import { flagsToEffort } from '../../flags-to-effort'
import { AiModelFlag } from '../../../constants/ai-model-flag'
import { createGoogleGenerativeAI, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { effortToBudgetAnthropic, effortToBudgetGoogle } from '../../effort-to-budget'
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic'

export const text = async (
  model: ModelSettings, messages: AiMessage[]
): Promise<AiResponse> => {
  const provider = createAnthropic({ apiKey: model.key })

  const reasoningEffort = flagsToEffort(model.flags || [])
  const thinkingBudget = effortToBudgetAnthropic(reasoningEffort)

  // only map last 4 messages to have cache control
  const newMessages = []

  let index = 0
  for (const m of messages) {

    if (index >= messages.length - 4) {
      newMessages.push(m)
    } else {
      newMessages.push({
        ...m,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
      })
    }

    index++
  }

  const response = streamText({
    model: provider.languageModel(model.id),
    onError: console.error,
    messages: newMessages,
    providerOptions: {
      anthropic: {
        thinking: {
          type: thinkingBudget > 0 ? 'enabled' : 'disabled',
          budgetTokens: thinkingBudget
        }
      } satisfies AnthropicProviderOptions
    }
  })

  return response.toDataStreamResponse().body
}
