export const fileMime = (buff: ArrayBuffer): string => {
  const arr = new Uint8Array(buff).subarray(0, 16) // does not create a copy, just a view.
  let header = ''

  for (let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16)
  }

  let result = 'unknown'

  switch (true) {
    case header.startsWith('89504e47'): // png apng
      result = 'image/png'
      break
    case header.startsWith('47494638'): // gif
      result = 'image/gif'
      break
    case header.startsWith('ffd8ffe'): // jpg
      result = 'image/jpeg'
      break
    case header.endsWith('66747970617669660000'): // avif
    case header.endsWith('667479706d6966310000'): // mif1 HEIF avif
      result = 'image/avif'
      break
    case header.endsWith('66747970617669730000'): // avif sequence
      result = 'image/avifs'
      break
    case header.endsWith('6674797068656963'): // heic
    case header.endsWith('6674797068656978'): // heic sequence
    case header.endsWith('667479706865766300'): // hevc (another heic variant)
      result = 'image/heic'
      break
    case !!header.match(/52494646[a-z-A-Z-0-9]*57454250/g): // webp
      result = 'image/webp'
      break
    case header.startsWith('25504446'): // pdf (%PDF)
      result = 'application/pdf'
      break
    case isText(arr): // text files (check if printable UTF-8)
      result = 'text/plain'
      break
  }

  return result
}

function isText(arr: Uint8Array): boolean {
  // check if the bytes form valid UTF-8 sequences
  let i = 0
  while (i < arr.length) {
    const byte = arr[i]

    if (byte <= 0x7F) {
      // ASCII character (0xxxxxxx)
      // allows printable ASCII + common whitespace
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        i++
        continue
      } else if (byte === 0) {
        // null byte suggests binary file
        return false
      }
      i++
    } else if ((byte & 0xE0) === 0xC0) {
      // 2-byte UTF-8 character (110xxxxx 10xxxxxx)
      if (i + 1 >= arr.length) return true // incomplete sequence at end is ok
      if ((arr[i + 1] & 0xC0) !== 0x80) return false
      i += 2
    } else if ((byte & 0xF0) === 0xE0) {
      // 3-byte UTF-8 character (1110xxxx 10xxxxxx 10xxxxxx)
      if (i + 2 >= arr.length) return true // incomplete sequence at end is ok
      if ((arr[i + 1] & 0xC0) !== 0x80 || (arr[i + 2] & 0xC0) !== 0x80) return false
      i += 3
    } else if ((byte & 0xF8) === 0xF0) {
      // 4-byte UTF-8 character (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
      if (i + 3 >= arr.length) return true // incomplete sequence at end is ok
      if ((arr[i + 1] & 0xC0) !== 0x80 || (arr[i + 2] & 0xC0) !== 0x80 || (arr[i + 3] & 0xC0) !== 0x80) return false
      i += 4
    } else {
      // invalid UTF-8 start byte
      return false
    }
  }
  return true
}
