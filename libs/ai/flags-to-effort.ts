import { AiModelFlag } from '../constants/ai-model-flag'

export type ReasoningEffort = undefined | 'low' | 'medium' | 'high'

export const flagsToEffort = (flags: AiModelFlag[]): ReasoningEffort => {
  switch (true) {
    case flags.includes(AiModelFlag.MediumReasoning):
    case flags.includes(AiModelFlag.AnyReasoning):
      return 'medium'
    case flags.includes(AiModelFlag.HighReasoning):
      return 'high'
    case flags.includes(AiModelFlag.LowReasoning):
      return 'low'
  }
}
