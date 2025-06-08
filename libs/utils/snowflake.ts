import { SnowflakeEpoch } from '../constants/snowflake-epoch'
import { randomBytes } from 'node:crypto'

let increment = 0

export const snowflake = (
  worker: string = randomBytes(29).toString('hex'),
  date = Date.now(),
) => {
  const b = BigInt

  if (increment > 62) {
    increment = 0
  }

  // 42 bits timestamp, 22 empty bits, 16 bits worker id, 6 bits increment
  const timestampBits = b(date - SnowflakeEpoch) << 22n
  // 22 bits worker id, 6 empty bits, 6 bits increment
  const workerBits = b('0x' + worker.replace(/-/g, '')) & (0x1fffffffn << 6n)
  // 6 bits increment
  const incrementBits = b(increment++)

  return (timestampBits | workerBits | incrementBits).toString()
}

export const deconstructSnowflake = (snowflake: string) => {
  const b = BigInt

  const snowflakeBigInt = b(snowflake)

  const timestamp = Number((snowflakeBigInt >> 22n) + BigInt(SnowflakeEpoch))
  const workerId = Number((snowflakeBigInt >> 6n) & 0x1fffffffn)
  const increment = Number(snowflakeBigInt & 0x3fn)

  return {
    timestamp,
    workerId,
    increment,
  }
}
