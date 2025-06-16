import { generateText, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { ModelSettings } from '../../../db/schema'
import { AiMessage } from '../../message-to-ai'
import { AiToolName } from '../../../constants/ai-tool-name'
import { AiResponse } from '../../ai-response'
import { flagsToEffort } from '../../flags-to-effort'
import { AiModelFlag } from '../../../constants/ai-model-flag'
import { createGoogleGenerativeAI, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { effortToBudgetGoogle } from '../../effort-to-budget'
import { inspect } from 'node:util'

export const text = async (
  model: ModelSettings, messages: AiMessage[]
): Promise<AiResponse> => {
  const provider = createGoogleGenerativeAI({ apiKey: model.key })

  const reasoningEffort = flagsToEffort(model.flags || [])
  const thinkingBudget = effortToBudgetGoogle(reasoningEffort)

  const searchForced = model.flags?.includes(AiModelFlag.WebSearch)

  let toolChoice: ({ type: 'tool', toolName: AiToolName.WebSearch }) | undefined

  switch (true) {
    case !!searchForced:
      toolChoice = { type: 'tool', toolName: AiToolName.WebSearch }
      break
  }

  console.log(inspect(messages, { depth: Infinity, colors: true }))

  console.log(
    await generateText({
      model: provider.chat(model.id),
      messages,
    }),
  )

  const response = streamText({
    model: provider.chat(model.id),
    messages,
    tools: {
      // TODO: use google's search
      [AiToolName.WebSearch]: openai.tools.webSearchPreview(),
    },
    toolChoice,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget
        }
      } satisfies GoogleGenerativeAIProviderOptions
    }
  })

  return response.toDataStreamResponse().body
}
