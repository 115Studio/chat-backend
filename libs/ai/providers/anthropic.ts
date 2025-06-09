import { AiModel } from '../../constants/ai-model'
import { AiMessage } from '../send-message'

export const anthropic = async (
  auth: string | undefined,
  model: AiModel,
  messages: AiMessage[],
): Promise<ReadableStream | null> => {
  if (!auth) {
    console.error('Anthropic API key is missing')
    return null
  }

  // Extract system messages and filter them out from the messages array
  const systemMessages = messages.filter(msg => msg.role === 'system')
  const conversationMessages = messages.filter(msg => msg.role !== 'system')
  
  // Combine all system messages into one system prompt
  const systemPrompt = systemMessages.map(msg => msg.content).join('\n\n')

  const requestBody: any = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  }

  // Add system prompt if it exists
  if (systemPrompt) {
    requestBody.system = systemPrompt
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': auth,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    console.error('Anthropic API error:', response.statusText, await response.text())
    return null
  }

  // Parse the SSE stream and return standardized text chunks
  return new ReadableStream({
    start(controller) {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') {
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(data)
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    controller.enqueue(parsed.delta.text)
                  }
                } catch (e) {
                  // Ignore parsing errors for non-JSON lines
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
