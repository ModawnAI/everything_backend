export class CustomError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class InternalServerError extends CustomError {
  constructor(message: string) {
    super(message, 500);
  }
}

export const handleError = (error: Error, req: any, res: any, next: any) => {
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      statusCode: error.statusCode
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    statusCode: 500
  });
};

