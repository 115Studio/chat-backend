export enum ErrorCode {
  UnknownError,
}

export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UnknownError]: 'Unknown error',
}
