import { ReasoningEffort } from './flags-to-effort'

export const effortToBudgetGoogle = (effort: ReasoningEffort): number => {
    switch (effort) {
      case 'low':
        return 1024
      case 'medium':
        return 2048
      case 'high':
        return 4096
      default:
        return 0
    }
}

export const effortToBudgetAnthropic = (effort: ReasoningEffort): number => {
    switch (effort) {
      case 'low':
        return 1024
      case 'medium':
        return 2048
      case 'high':
        return 4096
      default:
        return 0
    }
}
