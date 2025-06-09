import { AiModel } from '../../constants/ai-model'
import { AiMessage } from '../send-message'

export const openai = async (
  auth: string | undefined,
  model: AiModel,
  messages: AiMessage[],
): Promise<ReadableStream | null> => {
  if (!auth) {
    console.error('OpenAI API key is missing')
    return null
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    }),
  })

  if (!response.ok) {
    console.error('OpenAI API error:', response.statusText, await response.text())
    return null
  }

  // Parse the OpenAI SSE stream and return standardized text chunks
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
                  if (parsed.choices?.[0]?.delta?.content) {
                    controller.enqueue(parsed.choices[0].delta.content)
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