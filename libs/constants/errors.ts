export enum ErrorCode {
  UnknownError,
  Unauthorized = 1000,
  AuthorizationFailed,
  ThirdPartyFailure,
}

export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UnknownError]: 'Unknown error',
  [ErrorCode.Unauthorized]: 'Unauthorized',
  [ErrorCode.AuthorizationFailed]: 'Authorization failed',
  [ErrorCode.ThirdPartyFailure]: 'Third-party service failure',
}
