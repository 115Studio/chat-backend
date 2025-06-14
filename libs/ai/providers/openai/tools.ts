import { z } from 'zod'
import { experimental_generateImage as generateImage, JSONValue, streamText, tool } from 'ai'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { ModelSettings } from '../../../db/schema'
import { modelToImageProvider } from './model-to-image-provider'
import { AiMessage } from '../../message-to-ai'
import { AiToolName } from '../../../constants/ai-tool-name'
import { AiResponse } from '../../ai-response'
import { flagsToEffort } from '../../flags-to-effort'
import { AiModelFlag } from '../../../constants/ai-model-flag'

export const imageGenDto = z.object({
  prompt: z.string().min(1).max(1000),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']),
  quality: z.enum(['low', 'medium', 'high']),
  n: z.number().min(1).max(3),
})

export type ImageGenerationInput = z.infer<typeof imageGenDto>

export const image = async (model: ModelSettings, input: ImageGenerationInput): Promise<Uint8Array[] | undefined> => {
  try {
    const validatedInput = imageGenDto.parse(input)

    const provider = createOpenAI({ apiKey: model.key })
    const client = provider.image(modelToImageProvider(model.id))

    const { images } = await generateImage({
      model: client,
      ...validatedInput,
    })

    if (!images.length) {
      return
    }

    return images.map((i) => i.uint8Array)
  } catch (e) {
    console.error('Image generation error:', e)
    return
  }
}

export const text = async (model: ModelSettings, messages: AiMessage[], id?: string): Promise<AiResponse> => {
  const provider = createOpenAI({ apiKey: model.key })

  const reasoningEffort = flagsToEffort(model.flags || [])

  const imageForced = model.flags?.includes(AiModelFlag.ImageGen)
  const searchForced = model.flags?.includes(AiModelFlag.WebSearch)

  let toolChoice: { type: 'tool'; toolName: AiToolName.ImageGen | AiToolName.WebSearch } | undefined

  switch (true) {
    case !!imageForced:
      toolChoice = { type: 'tool', toolName: AiToolName.ImageGen }
      break
    case !!searchForced:
      toolChoice = { type: 'tool', toolName: AiToolName.WebSearch }
      break
  }

  const response = streamText({
    model: provider.responses(model.id),
    messages: id ? [messages[messages.length - 1]] : messages,
    tools: {
      [AiToolName.WebSearch]: openai.tools.webSearchPreview(),
      [AiToolName.ImageGen]: tool({
        parameters: imageGenDto,
        execute: async (input: ImageGenerationInput) => {
          const images = await image(model, input)

          if (!images || images.length === 0) {
            throw new Error('Image generation failed or returned no images')
          }

          return images.map((img) => ({
            type: 'image',
            data: img,
          }))
        },
      }),
    },
    toolChoice,
    providerOptions: {
      openai: {
        previousResponseId: id as JSONValue,
        reasoningEffort: reasoningEffort as JSONValue,
      },
    },
  })

  return response.toDataStreamResponse().body
}
