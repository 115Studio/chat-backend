// import { StreamMessageUpdate } from '../send-message'
// import { ModelSettings } from '../../db/schema'
// import { MessageStageType } from '../../constants/message-stage-type'
// import { snowflake } from '../../utils/snowflake'
// import { AiMessage } from '../message-to-ai'
//
// export const google = async (
//   model: ModelSettings,
//   messages: AiMessage[],
// ): Promise<ReadableStream<StreamMessageUpdate> | null> => {
//   const auth = model.key
//
//   if (!auth) {
//     console.error('Google API key is missing')
//     return null
//   }
//
//   // Generate a thinking stage ID
//   const thinkingId = snowflake()
//
//   // Convert messages to Google's format
//   const contents = messages.map(msg => {
//     if (msg.role === 'system') {
//       const systemText = msg.content
//         .filter(s => s.type === MessageStageType.Text)
//         .map(s => s.content?.value || '')
//         .join('\n\n');
//
//       return {
//         role: 'user',
//         parts: [{ text: `System: ${systemText}` }]
//       };
//     }
//
//     // Convert message stages to Google parts
//     const parts = [];
//
//     for (const stage of msg.content) {
//       if (stage.type === MessageStageType.Text) {
//         parts.push({ text: stage.content?.value || '' });
//       } else if (stage.type === MessageStageType.Vision) {
//         parts.push({
//           inline_data: {
//             mime_type: 'image/jpeg', // Assuming JPEG by default
//             data: stage.content?.value || ''
//           }
//         });
//       }
//     }
//
//     return {
//       role: msg.role === 'assistant' ? 'model' : 'user',
//       parts: parts.length ? parts : [{ text: '' }]
//     };
//   });
//
//   // Create a stream that first emits a "thinking" event
//   return new ReadableStream<StreamMessageUpdate>({
//     async start(controller) {
//       // Emit a "thinking" stage at the beginning
//       controller.enqueue({
//         type: MessageStageType.Think,
//         id: thinkingId,
//         content: 'Thinking...'
//       });
//
//       try {
//         const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:streamGenerateContent?alt=sse&key=${auth}`, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({
//             contents,
//             generationConfig: {
//               maxOutputTokens: 4096,
//             },
//           }),
//         });
//
//         if (!response.ok) {
//           console.error('Google API error:', response.statusText, await response.text())
//           controller.close()
//           return
//         }
//
//         // Generate an ID for the text response
//         const textId = snowflake()
//
//         // Start by emitting an empty text stage
//         controller.enqueue({
//           type: MessageStageType.Text,
//           id: textId,
//           content: ''
//         });
//
//         const reader = response.body?.getReader()
//         const decoder = new TextDecoder()
//         let buffer = ''
//         let isSSEFormat = false
//         let currentContent = ''
//
//         while (true) {
//           const { done, value } = await reader!.read()
//           if (done) {
//             // If we have remaining buffer and no streaming response detected, try to parse as single response
//             if (buffer.trim() && !isSSEFormat) {
//               try {
//                 const parsed = JSON.parse(buffer.trim())
//                 if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
//                   const text = parsed.candidates[0].content.parts[0].text
//                   currentContent += text
//
//                   controller.enqueue({
//                     type: MessageStageType.Text,
//                     id: textId,
//                     content: currentContent
//                   })
//                 }
//               } catch (e) {
//                 // Ignore parsing errors for non-JSON lines
//               }
//             }
//             break
//           }
//
//           const chunk = decoder.decode(value, { stream: true })
//           buffer += chunk
//
//           // Check if this looks like SSE format (detect once)
//           if (!isSSEFormat && chunk.includes('data: ')) {
//             isSSEFormat = true
//           }
//
//           // Process based on detected format
//           if (isSSEFormat) {
//             // Process SSE chunks
//             const lines = buffer.split('\n')
//             buffer = lines.pop() || '' // Keep incomplete line in buffer
//
//             for (const line of lines) {
//               const trimmedLine = line.trim()
//
//               if (trimmedLine.startsWith('data: ')) {
//                 const jsonData = trimmedLine.slice(6) // Remove 'data: ' prefix
//
//                 if (jsonData === '[DONE]') {
//                   controller.close()
//                   return
//                 }
//
//                 if (jsonData.trim()) {
//                   try {
//                     const parsed = JSON.parse(jsonData)
//                     if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
//                       const text = parsed.candidates[0].content.parts[0].text
//                       currentContent += text
//
//                       controller.enqueue({
//                         type: MessageStageType.Text,
//                         id: textId,
//                         content: currentContent
//                       })
//                     }
//                   } catch (e) {
//                     // Ignore parsing errors for non-JSON lines
//                   }
//                 }
//               }
//             }
//           } else {
//             // Try to parse as regular JSON streaming (multiple JSON objects)
//             const lines = buffer.split('\n')
//             buffer = lines.pop() || ''
//
//             for (const line of lines) {
//               const trimmedLine = line.trim()
//               if (trimmedLine && trimmedLine !== ',' && !trimmedLine.startsWith('[') && !trimmedLine.startsWith(']')) {
//                 try {
//                   // Remove trailing comma if present
//                   const cleanLine = trimmedLine.endsWith(',') ? trimmedLine.slice(0, -1) : trimmedLine
//                   const parsed = JSON.parse(cleanLine)
//
//                   if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
//                     const text = parsed.candidates[0].content.parts[0].text
//                     currentContent += text
//
//                     controller.enqueue({
//                       type: MessageStageType.Text,
//                       id: textId,
//                       content: currentContent
//                     })
//                   }
//                 } catch (e) {
//                   // Ignore parsing errors for non-JSON lines
//                 }
//               }
//             }
//           }
//         }
//       } catch (error) {
//         console.error('Error in Google stream:', error)
//         controller.error(error)
//       } finally {
//         controller.close()
//       }
//     }
//   })
// }
