export enum ErrorCode {
  UnknownError,
  BadRequest = 400,
  Unauthorized = 1000,
  AuthorizationFailed,
  ThirdPartyFailure,
  RateLimitExceeded,
  UnknownChannel,
}

export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UnknownError]: 'Unknown error',
  [ErrorCode.BadRequest]: 'Bad request',
  [ErrorCode.Unauthorized]: 'Unauthorized',
  [ErrorCode.AuthorizationFailed]: 'Authorization failed',
  [ErrorCode.ThirdPartyFailure]: 'Third-party service failure',
  [ErrorCode.RateLimitExceeded]: 'Rate limit exceeded',
  [ErrorCode.UnknownChannel]: 'Unknown channel',
}
