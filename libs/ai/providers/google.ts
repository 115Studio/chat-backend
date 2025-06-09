import { AiModel } from '../../constants/ai-model'
import { AiMessage } from '../send-message'

export const google = async (
  auth: string | undefined,
  model: AiModel,
  messages: AiMessage[],
): Promise<ReadableStream | null> => {
  if (!auth) {
    console.error('Google API key is missing')
    return null
  }

  // Convert messages to Google's format
  const contents = messages.map(msg => {
    if (msg.role === 'system') {
      return {
        role: 'user',
        parts: [{ text: `System: ${msg.content}` }]
      }
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }
  })

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${auth}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    }),
  })

  if (!response.ok) {
    console.error('Google API error:', response.statusText, await response.text())
    return null
  }

  // Parse the Google streaming response and return standardized text chunks
  return new ReadableStream({
    start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let isSSEFormat = false

      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) {
              // If we have remaining buffer and no streaming response detected, try to parse as single response
              if (buffer.trim() && !isSSEFormat) {
                try {
                  const parsed = JSON.parse(buffer.trim())
                  if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const text = parsed.candidates[0].content.parts[0].text
                    controller.enqueue(text)
                  }
                } catch (e) {
                  // Ignore parsing errors for non-JSON lines
                }
              }
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            // Check if this looks like SSE format (detect once)
            if (!isSSEFormat && chunk.includes('data: ')) {
              isSSEFormat = true
            }

            // Process based on detected format
            if (isSSEFormat) {
              // Process SSE chunks
              const lines = buffer.split('\n')
              buffer = lines.pop() || '' // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmedLine = line.trim()
                
                if (trimmedLine.startsWith('data: ')) {
                  const jsonData = trimmedLine.slice(6) // Remove 'data: ' prefix
                  
                  if (jsonData === '[DONE]') {
                    controller.close()
                    return
                  }
                  
                  if (jsonData.trim()) {
                    try {
                      const parsed = JSON.parse(jsonData)
                      if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                        const text = parsed.candidates[0].content.parts[0].text
                        controller.enqueue(text)
                      }
                    } catch (e) {
                      // Ignore parsing errors for non-JSON lines
                    }
                  }
                }
              }
            } else {
              // Try to parse as regular JSON streaming (multiple JSON objects)
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (trimmedLine && trimmedLine !== ',' && !trimmedLine.startsWith('[') && !trimmedLine.startsWith(']')) {
                  try {
                    // Remove trailing comma if present
                    const cleanLine = trimmedLine.endsWith(',') ? trimmedLine.slice(0, -1) : trimmedLine
                    const parsed = JSON.parse(cleanLine)
                    
                    if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                      const text = parsed.candidates[0].content.parts[0].text
                      controller.enqueue(text)
                    }
                  } catch (e) {
                    // Ignore parsing errors for non-JSON lines
                  }
                }
              }
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      }

      pump()
    }
  })
} 