import { fileMime } from './file-mime'

export const fileExtension = (input: ArrayBuffer, defaultMime?: string): string | undefined => {
  const mime = defaultMime ?? fileMime(input)

  switch (mime) {
    case 'unknown':
      return
    case 'text/plain':
      return 'txt'

    default:
      const parts = mime.split('/')

      if (parts.length > 1) {
        return parts[1]
      }

      return
  }
}
