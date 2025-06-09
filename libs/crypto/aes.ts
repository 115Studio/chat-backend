import { EventEnvironment } from '../../environment'

export interface EncryptedData {
  data: string
  iv: string
}

// Convert string to ArrayBuffer
const stringToArrayBuffer = (str: string): ArrayBuffer => {
  return new TextEncoder().encode(str).buffer as ArrayBuffer
}

// Convert ArrayBuffer to string
const arrayBufferToString = (buffer: ArrayBuffer): string => {
  return new TextDecoder().decode(buffer)
}

// Convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

// Generate encryption key from secret
const getKey = async (secret: string): Promise<any> => {
  const keyData = stringToArrayBuffer(secret)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export const encryptAes = async (
  e: EventEnvironment,
  plaintext: string
): Promise<EncryptedData> => {
  try {
    const key = await getKey(e.AES_KEY)
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for AES-GCM
    const data = stringToArrayBuffer(plaintext)

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    )

    return {
      data: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv.buffer)
    }
  } catch (err) {
    console.error('AES encryption failed:', err)
    throw new Error('Encryption failed')
  }
}

export const decryptAes = async (
  e: EventEnvironment,
  encryptedData: EncryptedData
): Promise<string | null> => {
  try {
    const key = await getKey(e.AES_KEY)
    const iv = base64ToArrayBuffer(encryptedData.iv)
    const data = base64ToArrayBuffer(encryptedData.data)

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    )

    return arrayBufferToString(decrypted)
  } catch (err) {
    console.error('AES decryption failed:', err)
    return null
  }
}
