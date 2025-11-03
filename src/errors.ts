/**
 * Base error class for all RAIL Score SDK errors
 */
export class RailScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RailScoreError';
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Authentication error - thrown when API key is invalid or missing
 */
export class AuthenticationError extends RailScoreError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Insufficient credits error - thrown when account has insufficient credits
 */
export class InsufficientCreditsError extends RailScoreError {
  /** Current credit balance */
  balance: number;
  /** Credits required for the request */
  required: number;

  constructor(balance: number, required: number) {
    super(`Insufficient credits. Balance: ${balance}, Required: ${required}`);
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.required = required;
  }
}

/**
 * Validation error - thrown when request parameters are invalid
 */
export class ValidationError extends RailScoreError {
  /** Field that failed validation (if applicable) */
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Rate limit error - thrown when API rate limit is exceeded
 */
export class RateLimitError extends RailScoreError {
  /** Number of seconds to wait before retrying */
  retryAfter: number;

  constructor(retryAfter: number = 60) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error - thrown when request times out
 */
export class TimeoutError extends RailScoreError {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Network error - thrown when network request fails
 */
export class NetworkError extends RailScoreError {
  /** Original error that caused the network failure */
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Server error - thrown when server returns 5xx status
 */
export class ServerError extends RailScoreError {
  /** HTTP status code */
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ServerError';
    this.statusCode = statusCode;
  }
}

/**
 * Content too long error - thrown when content exceeds maximum length
 */
export class ContentTooLongError extends ValidationError {
  /** Maximum allowed length */
  maxLength: number;
  /** Actual content length */
  actualLength: number;

  constructor(maxLength: number, actualLength: number) {
    super(`Content too long. Maximum: ${maxLength}, Actual: ${actualLength}`);
    this.name = 'ContentTooLongError';
    this.maxLength = maxLength;
    this.actualLength = actualLength;
  }
}
