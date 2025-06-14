import { EventEnvironment } from '../../environment'
import { fileMime } from './file-mime'
import { fileExtension } from './file-extension'
import { makeTextError } from './make-error'
import { ErrorCode } from '../constants/errors'
import { sha1 } from './sha1'
import { slashEnded } from './slash-ended'

export interface UploadResult {
  sha: string
  mime: string
  url: string
  size: number
}

export const upload = async (
  env: EventEnvironment, userId: string, file: ArrayBuffer | Uint8Array
): Promise<UploadResult | string> => {
  const mime = fileMime(file)
  const ext = fileExtension(file, mime)

  if (!ext) {
    return makeTextError(ErrorCode.UnsupportedFileType)
  }

  const name = await sha1(file)

  const fileName = `${name}.${ext}`

  const key = `uploads/${userId}/${fileName}`

  const url = `${slashEnded(env.CDN_ENDPOINT)}${key}`

  const uploadResult = await env.R2.put(key, file)

  if (!uploadResult) {
    return makeTextError(ErrorCode.UploadFailed)
  }

  return {
    sha: name,
    mime,
    url,
    size: file.byteLength,
  }
}
