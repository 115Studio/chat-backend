import { ModelSettings } from '../db/schema'

export const mergeModelAuth = (model: ModelSettings, key?: string): ModelSettings => {
  return {
    ...model,
    key: model.key ?? key,
  }
}
