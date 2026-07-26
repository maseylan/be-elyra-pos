export class UnauthorizedError extends Error {
  public statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class TooManyRequestsError extends Error {
  public statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class NotFoundError extends Error {
  public statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  public statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class PaymentRequiredError extends Error {
  public statusCode = 402;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequiredError';
  }
}
