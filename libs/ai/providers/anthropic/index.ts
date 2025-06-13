// import { streamText, tool } from 'ai'
// import { anthropic as anthropicProvider } from '@ai-sdk/anthropic'
// import { z } from 'zod'
// import { StreamMessageUpdate } from '../../send-message'
// import { ModelSettings } from '../../../db/schema'
// import { MessageStageType } from '../../../constants/message-stage-type'
// import { snowflake } from '../../../utils/snowflake'
// import { AiModelFlag } from '../../../constants/ai-model-flag'
// import { AiModelFeature } from '../../../constants/ai-model-feature'
// import { modelToFeatures } from '../../model-to-features'
// import { makeError } from '../../../utils/make-error'
// import { ErrorCode } from '../../../constants/errors'
// import { AiMessage } from '../../message-to-ai'
//
// export const anthropic= async (
//   model: ModelSettings,
//   messages: AiMessage[],
// ): Promise<ReadableStream<StreamMessageUpdate> | null> => {
//   const auth = model.key
//
//   if (!auth) {
//     console.error('Anthropic API key is missing')
//     return null
//   }
//
//   // Check model capabilities
//   const modelFeatures = modelToFeatures(model.id)
//   const supportsWebSearch = modelFeatures.includes(AiModelFeature.WebSearch) ||
//                           (model.flags && model.flags.includes(AiModelFlag.WebSearch))
//   const supportsImageGen = modelFeatures.includes(AiModelFeature.ImageGen) ||
//                           (model.flags && model.flags.includes(AiModelFlag.ImageGen))
//   const supportsVision = modelFeatures.includes(AiModelFeature.Vision)
//   const supportsPdfScan = modelFeatures.includes(AiModelFeature.PdfScan)
//   const supportsReasoning = modelFeatures.includes(AiModelFeature.Reasoning)
//
//   // Define tools with Zod schemas
//   const tools: Record<string, any> = {}
//
//   if (supportsWebSearch) {
//     tools.webSearch = tool({
//       description: 'Search the web for current information on any topic',
//       parameters: z.object({
//         query: z.string().describe('The search query to look up'),
//       }),
//       execute: async ({ query }) => {
//         return `Searching for: ${query}`
//       },
//     })
//   }
//
//   if (supportsImageGen) {
//     tools.imageGeneration = tool({
//       description: 'Generate images based on text descriptions',
//       parameters: z.object({
//         prompt: z.string().describe('Description of the image to generate'),
//         style: z.enum(['realistic', 'artistic', 'cartoon', 'abstract']).optional().describe('Style of the image'),
//       }),
//       execute: async ({ prompt, style }) => {
//         return `Generating image: ${prompt} (style: ${style || 'realistic'})`
//       },
//     })
//   }
//
//   if (supportsPdfScan) {
//     tools.analyzeDocument = tool({
//       description: 'Analyze and extract information from PDF documents',
//       parameters: z.object({
//         document_url: z.string().describe('URL of the document to analyze'),
//         analysis_type: z.enum(['summary', 'extract_text', 'analyze_structure', 'find_information']).describe('Type of analysis to perform'),
//       }),
//       execute: async ({ document_url, analysis_type }) => {
//         return `Analyzing document: ${document_url} (type: ${analysis_type})`
//       },
//     })
//   }
//
//   // Transform messages to AI SDK format
//   const aiMessages: any[] = []
//
//   for (const msg of messages) {
//     if (msg.role === 'system') {
//       // For system messages, combine all text content
//       const systemText = msg.content
//         .filter(s => s.type === MessageStageType.Text)
//         .map(s => s.content?.value || '')
//         .join('\n\n')
//       aiMessages.push({
//         role: 'system',
//         content: systemText
//       })
//     } else {
//       // For user/assistant messages, handle different content types
//       const contentParts = []
//
//       for (const stage of msg.content) {
//         switch (stage.type) {
//           case MessageStageType.Text:
//             contentParts.push({
//               type: 'text',
//               text: stage.content?.value || ''
//             })
//             break
//
//           case MessageStageType.Vision:
//             if (supportsVision && stage.content?.value) {
//               contentParts.push({
//                 type: 'image',
//                 image: stage.content.value
//               })
//             }
//             break
//
//           case MessageStageType.Pdf:
//           case MessageStageType.File:
//             if (stage.content?.value) {
//               contentParts.push({
//                 type: 'text',
//                 text: `[Document: ${stage.content.value}]`
//               })
//             }
//             break
//
//           case MessageStageType.Audio:
//             throw makeError(ErrorCode.UnsupportedStage, 400)
//         }
//       }
//
//       aiMessages.push({
//         role: msg.role,
//         content: contentParts.length > 0 ? contentParts : 'Empty message'
//       })
//     }
//   }
//
//   // Create the Anthropic model instance
//   // Note: API key should be set via ANTHROPIC_API_KEY environment variable
//   const anthropicModel = anthropicProvider(model.id)
//
//   // Generate stage IDs
//   const thinkingId = snowflake()
//   const textId = snowflake()
//
//   return new ReadableStream<StreamMessageUpdate>({
//     async start(controller) {
//       // Emit thinking stage for reasoning models
//       if (supportsReasoning) {
//         controller.enqueue({
//           type: MessageStageType.Think,
//           id: thinkingId,
//           content: 'Processing your request...'
//         })
//       }
//
//       try {
//         // Use AI SDK's streamText
//         const result = await streamText({
//           model: anthropicModel,
//           messages: aiMessages,
//           tools: Object.keys(tools).length > 0 ? tools : undefined,
//           maxSteps: 5,
//         })
//
//         let currentTextContent = ''
//         const activeToolStages = new Map<string, string>()
//
//         // Handle the stream
//         for await (const delta of result.fullStream) {
//           switch (delta.type) {
//             case 'text-delta':
//               currentTextContent += delta.textDelta
//               controller.enqueue({
//                 type: MessageStageType.Text,
//                 id: textId,
//                 content: currentTextContent
//               })
//               break
//
//             case 'tool-call':
//               const toolStageId = snowflake()
//               activeToolStages.set(delta.toolCallId, toolStageId)
//
//               // Determine the appropriate stage type based on tool name
//               let stageType = MessageStageType.Text
//               if (delta.toolName === 'webSearch') {
//                 stageType = MessageStageType.WebSearch
//               } else if (delta.toolName === 'imageGeneration') {
//                 stageType = MessageStageType.VisionGen
//               }
//
//               controller.enqueue({
//                 type: stageType,
//                 id: toolStageId,
//                 content: `Starting ${delta.toolName}: ${JSON.stringify(delta.args)}`
//               })
//               break
//
//             case 'tool-result':
//               const stageId = activeToolStages.get(delta.toolCallId)
//               if (stageId) {
//                 // Determine stage type again
//                 let resultStageType = MessageStageType.Text
//                 if (delta.toolName === 'webSearch') {
//                   resultStageType = MessageStageType.WebSearch
//                 } else if (delta.toolName === 'imageGeneration') {
//                   resultStageType = MessageStageType.VisionGen
//                 }
//
//                 controller.enqueue({
//                   type: resultStageType,
//                   id: stageId,
//                   content: `${delta.toolName} completed: ${typeof delta.result === 'string' ? delta.result : JSON.stringify(delta.result)}`
//                 })
//               }
//               break
//
//             case 'step-finish':
//               if (delta.finishReason === 'tool-calls') {
//                 // Tool calls completed, next step will continue
//               }
//               break
//
//             case 'finish':
//               controller.close()
//               return
//           }
//         }
//
//         controller.close()
//
//       } catch (error) {
//         console.error('Error in Anthropic AI SDK stream:', error)
//         controller.error(error)
//       }
//     }
//   })
// }
