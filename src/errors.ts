import type { PolicyMode } from './types';

/**
 * Base error class for all RAIL Score SDK errors.
 * All exceptions expose message, statusCode, and response.
 */
export class RailScoreError extends Error {
  /** HTTP status code (0 for client-side errors like timeout/network) */
  statusCode: number;
  /** Raw error response body from the API */
  response: any;

  constructor(message: string, statusCode: number = 0, response: any = {}) {
    super(message);
    this.name = 'RailScoreError';
    this.statusCode = statusCode;
    this.response = response;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 401 - Invalid or missing API key
 */
export class AuthenticationError extends RailScoreError {
  constructor(message: string = 'Invalid or missing API key', response?: any) {
    super(message, 401, response);
    this.name = 'AuthenticationError';
  }
}

/**
 * 402 - Not enough credits
 */
export class InsufficientCreditsError extends RailScoreError {
  /** Current credit balance */
  balance: number;
  /** Credits required for the request */
  required: number;

  constructor(balance: number, required: number, response?: any) {
    super(`Insufficient credits. Balance: ${balance}, Required: ${required}`, 402, response);
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.required = required;
  }
}

/**
 * 403 - Feature requires higher plan tier
 */
export class InsufficientTierError extends RailScoreError {
  /** Tier required for the operation */
  requiredTier: string;
  /** Current account tier */
  currentTier: string;

  constructor(requiredTier: string, currentTier: string, response?: any) {
    super(`Feature requires '${requiredTier}' tier. Current tier: '${currentTier}'`, 403, response);
    this.name = 'InsufficientTierError';
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
  }
}

/**
 * 400 - Invalid parameters
 */
export class ValidationError extends RailScoreError {
  /** Field that failed validation (if applicable) */
  field?: string;

  constructor(message: string, field?: string, response?: any) {
    super(message, 400, response);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * 410 - External-mode session expired (15 min TTL)
 */
export class SessionExpiredError extends RailScoreError {
  constructor(message: string = 'Session expired. External sessions last 15 minutes.', response?: any) {
    super(message, 410, response);
    this.name = 'SessionExpiredError';
  }
}

/**
 * 422 - Content avg score < 3.0, cannot regenerate
 */
export class ContentTooHarmfulError extends RailScoreError {
  constructor(message: string = 'Content too harmful to regenerate (avg score < 3.0)', response?: any) {
    super(message, 422, response);
    this.name = 'ContentTooHarmfulError';
  }
}

/**
 * 429 - Rate limit exceeded
 */
export class RateLimitError extends RailScoreError {
  /** Number of seconds to wait before retrying */
  retryAfter: number;

  constructor(retryAfter: number = 60, response?: any) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, 429, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 - Internal server error (safe to retry)
 */
export class EvaluationFailedError extends RailScoreError {
  /** Request ID for tracking the failed evaluation */
  reqId?: string;

  constructor(message: string = 'Evaluation failed', reqId?: string, response?: any) {
    super(message, 500, response);
    this.name = 'EvaluationFailedError';
    this.reqId = reqId;
  }
}

/**
 * 501 - Feature not yet implemented
 */
export class NotImplementedByServerError extends RailScoreError {
  constructor(message: string = 'Feature not yet implemented', response?: any) {
    super(message, 501, response);
    this.name = 'NotImplementedByServerError';
  }
}

/**
 * 503 - Temporarily unavailable
 */
export class ServiceUnavailableError extends RailScoreError {
  /** Suggested retry delay in seconds */
  retryAfter?: number;

  constructor(message: string = 'Service temporarily unavailable', retryAfter?: number, response?: any) {
    super(message, 503, response);
    this.name = 'ServiceUnavailableError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Timeout error - request exceeded configured timeout
 */
export class TimeoutError extends RailScoreError {
  constructor(message: string = 'Request timeout') {
    super(message, 0);
    this.name = 'TimeoutError';
  }
}

/**
 * Network error - connection or DNS failure
 */
export class NetworkError extends RailScoreError {
  /** Original error that caused the network failure */
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, 0);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Generic server error for non-specific 5xx responses
 */
export class ServerError extends RailScoreError {
  constructor(message: string, statusCode: number = 500, response?: any) {
    super(message, statusCode, response);
    this.name = 'ServerError';
  }
}

/**
 * Content exceeds maximum length
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

/**
 * Content blocked by a policy engine rule
 */
export class RAILBlockedError extends RailScoreError {
  /** Policy mode that triggered the block */
  policyMode: PolicyMode;
  /** Dimension scores that caused the block */
  scores?: Record<string, any>;

  constructor(message: string, policyMode: PolicyMode, scores?: Record<string, any>) {
    super(message);
    this.name = 'RAILBlockedError';
    this.policyMode = policyMode;
    this.scores = scores;
  }
}
