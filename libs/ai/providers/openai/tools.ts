import { z } from 'zod'
import { CoreMessage, experimental_generateImage as generateImage, generateText, streamText, tool } from 'ai'
import { createOpenAI, openai, OpenAIProvider } from '@ai-sdk/openai'
import { MessageStageType } from '../../../constants/message-stage-type'
import { snowflake } from '../../../utils/snowflake'
import { MessageStage, MessageStages, ModelSettings } from '../../../db/schema'
import { AiModel } from '../../../constants/ai-model'
import { MessageStageContentType } from '../../../constants/message-stage-content-type'
import { modelToImageProvider } from './model-to-image-provider'
import { EventEnvironment } from '../../../../environment'
import { AiMessage } from '../../message-to-ai'

// Image Generation Tool DTO
export const imageGenDto = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).optional().default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  n: z.number().min(1).max(10).optional().default(1),
})

export type ImageGenerationInput = z.infer<typeof imageGenDto>

// Web Search Tool DTO
export const webSearchDto = z.object({
  query: z.string().min(1, 'Search query is required'),
  maxResults: z.number().min(1).max(20).optional().default(10),
})

export type WebSearchInput = z.infer<typeof webSearchDto>

export const image = async (
  model: ModelSettings, input: ImageGenerationInput
): Promise<Uint8Array[] | undefined> => {
  try {
    const validatedInput = imageGenDto.parse(input)

    const provider = createOpenAI({ apiKey: model.key })
    const client = provider.image(modelToImageProvider(model.id))

    const generateParams = {
      model: client,
      prompt: validatedInput.prompt,

      size: validatedInput.size || 'auto',
      quality: validatedInput.quality || 'medium',
      n: validatedInput.n || 1,
    }

    const { images } = await generateImage(generateParams)

    if (!images.length) {
      return
    }

    return images.map(i => i.uint8Array)
  } catch (e) {
    console.error('Image generation error:', e)
    return
  }
}

// Logging utility for stream monitoring
const logStreamEvent = (event: string, data?: any) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] STREAM ${event}:`, data || '')
}

export const text = async (
  model: ModelSettings, messages: AiMessage[]
) => {
  logStreamEvent('STARTED', { modelId: model.id, messageCount: messages.length })

  const provider = createOpenAI({ apiKey: model.key })

  const response = streamText({
    model: provider.responses(model.id),
    messages,
    tools: {
      web_search: openai.tools.webSearchPreview(),
      console_log: tool({
        parameters: z.object({
          message: z.string().min(1, 'Message is required'),
        }),
        execute: async (input) => {
          logStreamEvent('TOOL_EXECUTE', { tool: 'console_log', message: input.message })
          console.log('Console Log:', input.message)
          return { type: 'text', data: input.message }
        },
      })
      // generate_image_custom: tool({
      //   parameters: imageGenDto,
      //   execute: async (input: ImageGenerationInput) => {
      //     logStreamEvent('TOOL_EXECUTE', { tool: 'generate_image', prompt: input.prompt })
      //
      //     // Additional validation - reject prompts that seem to be asking about existing content
      //     const prompt = input.prompt.toLowerCase()
      //     const restrictedKeywords = ['logo', 'branding', 'existing', 'show me', 'what does', 'describe']
      //     const hasRestrictedKeyword = restrictedKeywords.some(keyword => prompt.includes(keyword))
      //
      //     if (hasRestrictedKeyword) {
      //       logStreamEvent('TOOL_BLOCKED', { tool: 'generate_image', reason: 'Restricted keyword detected', prompt: input.prompt })
      //       throw new Error('Image generation blocked: This appears to be asking about existing content rather than requesting new image creation.')
      //     }
      //
      //     const images = await image(model, input)
      //
      //     if (!images || images.length === 0) {
      //       logStreamEvent('TOOL_ERROR', { tool: 'generate_image', error: 'No images generated' })
      //       throw new Error('Image generation failed or returned no images')
      //     }
      //
      //     logStreamEvent('TOOL_SUCCESS', { tool: 'generate_image', imageCount: images.length })
      //     return images.map(img => ({
      //       type: 'image',
      //       data: img,
      //     }))
      //   },
      // })
    }
  })

  logStreamEvent('STREAM_CREATED', 'Converting to data stream response')

  const stream = response.toDataStreamResponse().body

  if (!stream) {
    logStreamEvent('ERROR', 'No stream available in response')
    return
  }

  const reader = stream.getReader()

  const processStream = async () => {
    try {
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          logStreamEvent('STREAM_DONE')
          logStreamEvent('FULL_TEXT', fullText)
          break
        }

        // Decode the stream chunk to text
        const chunk = decoder.decode(value, { stream: true })
        logStreamEvent('STREAM_CHUNK', chunk.substring(0, 1000))
      }
    } catch (error) {
      logStreamEvent('STREAM_ERROR', error)
    } finally {
      reader.releaseLock()
    }
  }

  await processStream()

  return new ReadableStream()
}

export const search = async (
  model: ModelSettings, messages: AiMessage[]
): Promise<MessageStages | undefined> => {
  const provider = createOpenAI({ apiKey: model.key })

  if (messages.length === 0) {
    return undefined
  }

  const response = await generateText({
    model: provider.languageModel(model.id),
    messages,
    tools: {
      web_search_preview: openai.tools.webSearchPreview(),
    },
  })

  const result: MessageStages = []

  if (response.reasoning) {
    result.push({
      id: snowflake(),
      type: MessageStageType.Think,
      content: {
        type: MessageStageContentType.Text,
        value: response.reasoning,
      },
    })
  }

  if (response.text) {
    result.push({
      id: snowflake(),
      type: MessageStageType.Text,
      content: {
        type: MessageStageContentType.Text,
        value: response.text,
      },
    })
  }

  if (response.sources.length) {
    for (const source of response.sources) {
      result.push({
        id: snowflake(),
        type: MessageStageType.Link,
        content: {
          type: MessageStageContentType.Url,
          value: source.url,
        },
      })
    }
  }

  if (response.files.length) {
    for (const file of response.files) {

      switch (true) {
        case file.mimeType.includes('image'):
          result.push({
            id: snowflake(),
            type: MessageStageType.Vision,
            content: {
              type: MessageStageContentType.Vision,
              value: file.base64,
            },
          })
          break

        case file.mimeType.includes('pdf'):
          result.push({
            id: snowflake(),
            type: MessageStageType.Pdf,
            content: {
              type: MessageStageContentType.File,
              value: file.base64,
            },
          })
          break

        case file.mimeType.includes('audio'):
          result.push({
            id: snowflake(),
            type: MessageStageType.Audio,
            content: {
              type: MessageStageContentType.Audio,
              value: file.base64,
            },
          })
          break

        case file.mimeType.includes('text'):
          result.push({
            id: snowflake(),
            type: MessageStageType.File,
            content: {
              type: MessageStageContentType.File,
              value: file.base64,
            },
          })
          break
      }
    }
  }

  return result
}
