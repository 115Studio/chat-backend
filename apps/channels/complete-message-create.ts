import { EventEnvironment } from '../../environment'
import { DbInstance } from '../../libs/db/init'
import { BYOK, Channel, channelsTable, Message, MessageStages } from '../../libs/db/schema'
import { JwtPayload } from '../../libs/crypto/jwt'
import { UserDo } from '../sync'
import { MessageStageType } from '../../libs/constants/message-stage-type'
import { AiMessage } from '../../libs/ai/message-to-ai'
import { askAi } from '../../libs/ai/ask-ai'
import { AiReturnType } from '../../libs/constants/ai-return-type'
import { AiModel } from '../../libs/constants/ai-model'
import { eq } from 'drizzle-orm'

export async function completeMessageCreate(
  env: EventEnvironment,
  db: DbInstance,
  channel: Channel,
  jwt: JwtPayload,
  stages: Required<MessageStages>,
  systemMessage: Message,
  userMessage: Message,
  history: Message[],
  isNew: boolean,
  personalityPrompt: string | undefined = undefined,
  byoks: BYOK[] = [],
  doStub: DurableObjectStub<UserDo>,
) {
  if (isNew) {
    await doStub.ackChannelCreate(jwt.id, channel)
  }

  await doStub.ackMessageCreate(jwt.id, userMessage)
  await doStub.ackMessageCreate(jwt.id, systemMessage)

  const complementPromise = doStub.complementMessage(
    jwt.id,
    systemMessage.id,
    channel.id,
    userMessage,
    history,
    personalityPrompt,
    byoks,
  )

  const textContentStage = stages.find((s) => s.type === MessageStageType.Text)
  const textContent = textContentStage?.content?.value

  const summarize = async (content: string) => {
    const summarizeSystemMessage: AiMessage[] = [
      {
        role: 'system',
        content:
          `You are a helpful assistant. Your task is to summarize the message and provide ` +
          `a response based on the user's message with ONLY 1-3 words long. Always use the same language as the user. ` +
          `Do not include any additional information or explanations. ` +
          `If the conversation is empty, just respond with "New chat"`,
      },
      {
        role: 'user',
        content,
      },
    ]

    const result = await askAi<AiReturnType.Complete>(
      env,
      { id: AiModel.GoogleGemini20Flash },
      summarizeSystemMessage,
      jwt.id,
      byoks,
      AiReturnType.Complete,
    )

    if (!result) {
      return 'New chat'
    }

    const resultStage = result.find((r) => r.type === MessageStageType.Text)
    const resultText = resultStage?.content?.value

    if (!resultText) {
      return 'New chat'
    }

    return resultText.trim()
  }

  const update = async (newName: string) => {
    const [newChannel] = await db
      .update(channelsTable)
      .set({ name: newName.trim(), updatedAt: Date.now() })
      .where(eq(channelsTable.id, channel.id))
      .returning()
      .execute()

    await doStub.ackChannelUpdate(jwt.id, newChannel)
  }

  const summarizeAndUpdate = async (content: string) => {
    return update(await summarize(content))
  }

  // Separate to avoid blocking the response
  if (isNew) {
    if (textContent) {
      await summarizeAndUpdate(textContent)
    }
  }

  const result = await complementPromise

  if (isNew && !textContent) {
    if (!result) {
      return update('New chat')
    }

    const resultTextStage = result.find((s) => s.type === MessageStageType.Text)
    const resultText = resultTextStage?.content?.value

    if (resultText) {
      return summarizeAndUpdate(resultText)
    } else {
      return update('New chat')
    }
  }

  return result
}
