import type { ZodError } from 'zod';

/** Machine-readable API error codes. Clients branch on these, never on messages. */
export type ApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'approval_not_on_chain'
  | 'approval_not_pending'
  | 'chain_unavailable'
  | 'internal_error';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'validation_error', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'Not allowed') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
export const approvalNotOnChain = (message: string) =>
  new ApiError(422, 'approval_not_on_chain', message);

export function fromZodError(err: ZodError): ApiError {
  return badRequest(
    'Request validation failed',
    err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

export type ErrorBody = { error: { code: ApiErrorCode; message: string; details?: unknown } };

export function toErrorBody(err: ApiError): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    },
  };
}
