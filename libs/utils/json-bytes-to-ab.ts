export function jsonBytesToArrayBuffer(jsonData: object) {
  const byteEntries = Object.entries(jsonData)

  const byteArray = new Uint8Array(byteEntries.length)

  for (let i = 0; i < byteEntries.length; i++) {
    byteArray[i] = byteEntries[i][1]
  }

  return byteArray.buffer
}
