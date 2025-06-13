import { MessageStageType } from '../constants/message-stage-type'
import { AiModelFeature } from '../constants/ai-model-feature'
import { makeError } from '../utils/make-error'
import { ErrorCode } from '../constants/errors'
import { MessageStages } from '../db/schema'

export const stageToFeature = (stage: MessageStageType): AiModelFeature => {
  switch (stage) {
    case MessageStageType.Text:
      return AiModelFeature.TextGen
    case MessageStageType.Vision:
      return AiModelFeature.Vision
    case MessageStageType.VisionGen:
      return AiModelFeature.ImageGen
    case MessageStageType.Pdf:
      return AiModelFeature.PdfScan
    case MessageStageType.WebSearch:
      return AiModelFeature.WebSearch
    case MessageStageType.Think:
      return AiModelFeature.Reasoning
    case MessageStageType.Audio:
      return AiModelFeature.AudioGen
    case MessageStageType.File:
      return AiModelFeature.FileScan

    default:
      throw makeError(ErrorCode.UnknownMessageStage, 500)
  }
}

export const stagesToFeatures = (stages: MessageStages): AiModelFeature[] => {
  return stages.map(s => stageToFeature(s.type))
}
