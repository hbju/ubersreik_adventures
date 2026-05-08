export const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: AppError };

export function success<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function failure<T = never>(code: ErrorCode, message: string, details?: unknown): ServiceResult<T> {
  return { data: null, error: { code, message, details } };
}
