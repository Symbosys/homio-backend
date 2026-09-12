export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: any,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: any) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: any) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', details?: any) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details?: any) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export interface StandardErrorPayload {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
  };
}

export function formatErrorResponse(err: unknown): { statusCode: number; payload: StandardErrorPayload } {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      payload: {
        success: false,
        error: {
          message: err.message,
          code: err.code,
          statusCode: err.statusCode,
          details: err.details,
        },
      },
    };
  }

  const error = err instanceof Error ? err : new Error(String(err));
  return {
    statusCode: 500,
    payload: {
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        details: process.env.NODE_ENV === 'production' ? undefined : { stack: error.stack },
      },
    },
  };
}
