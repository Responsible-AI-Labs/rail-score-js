import fetch, { Response, RequestInit } from 'node-fetch';
import type {
  RailScoreConfig,
  CreditBalance,
  UsageStats,
  HealthCheckResponse,
} from './types';
import { Evaluation } from './evaluation';
import { Generation } from './generation';
import { Compliance } from './compliance';
import {
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  ValidationError,
  RailScoreError,
  TimeoutError,
  NetworkError,
  ServerError,
} from './errors';

/**
 * Main RailScore client for interacting with the RAIL Score API
 *
 * @example
 * ```typescript
 * const client = new RailScore({
 *   apiKey: process.env.RAIL_API_KEY!
 * });
 *
 * const result = await client.evaluation.basic('Your content here');
 * console.log(`Score: ${result.railScore.score}/10`);
 * ```
 */
export class RailScore {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  /** Evaluation API methods */
  public readonly evaluation: Evaluation;

  /** Generation API methods */
  public readonly generation: Generation;

  /** Compliance API methods */
  public readonly compliance: Compliance;

  /**
   * Initialize the RailScore client
   *
   * @param config - Configuration options
   * @throws {ValidationError} If API key is missing
   */
  constructor(config: RailScoreConfig) {
    if (!config.apiKey) {
      throw new ValidationError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.responsibleailabs.ai';
    this.timeout = config.timeout || 60000; // 60 seconds default

    // Initialize API modules
    this.evaluation = new Evaluation(this);
    this.generation = new Generation(this);
    this.compliance = new Compliance(this);
  }

  /**
   * Make an HTTP request to the API
   *
   * @internal
   * @param endpoint - API endpoint path
   * @param options - Fetch options
   * @returns Promise resolving to the response data
   * @throws {RailScoreError} On API errors
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'rail-score-js/1.0.0',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleError(response);
      }

      return await response.json() as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Re-throw RailScoreError instances
      if (error instanceof RailScoreError) {
        throw error;
      }

      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${this.timeout}ms`);
      }

      // Handle network errors
      throw new NetworkError(
        `Network request failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Handle API error responses
   *
   * @internal
   * @param response - Fetch response object
   * @throws {RailScoreError} Appropriate error based on status code
   */
  private async handleError(response: Response): Promise<never> {
    const status = response.status;
    let errorData: any;

    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    // Ensure errorData is an object
    if (!errorData || typeof errorData !== 'object') {
      errorData = { message: response.statusText };
    }

    const message = errorData.message || errorData.error || 'Unknown error';

    switch (status) {
      case 401:
        throw new AuthenticationError(message);

      case 402:
        throw new InsufficientCreditsError(
          errorData.balance || 0,
          errorData.required || 0
        );

      case 422:
        throw new ValidationError(message, errorData.field);

      case 429:
        throw new RateLimitError(errorData.retry_after || 60);

      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(message, status);

      default:
        throw new RailScoreError(
          `Request failed with status ${status}: ${message}`
        );
    }
  }

  /**
   * Get current credit balance
   *
   * @returns Promise resolving to credit balance information
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const credits = await client.getCredits();
   * console.log(`Balance: ${credits.balance} credits`);
   * ```
   */
  async getCredits(): Promise<CreditBalance> {
    return this.request<CreditBalance>('/v1/credits', { method: 'GET' });
  }

  /**
   * Get usage statistics
   *
   * @param limit - Maximum number of records to return (default: 50)
   * @param fromDate - Start date in ISO format (optional)
   * @returns Promise resolving to usage statistics
   * @throws {AuthenticationError} If API key is invalid
   *
   * @example
   * ```typescript
   * const usage = await client.getUsage(100, '2024-01-01');
   * console.log(`Total requests: ${usage.summary.totalRequests}`);
   * ```
   */
  async getUsage(limit: number = 50, fromDate?: string): Promise<UsageStats> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(fromDate && { from_date: fromDate }),
    });

    return this.request<UsageStats>(
      `/v1/usage?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * Perform health check on the API
   *
   * @returns Promise resolving to health status
   *
   * @example
   * ```typescript
   * const health = await client.healthCheck();
   * console.log(`API Status: ${health.ok ? 'OK' : 'Down'}`);
   * ```
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/health', { method: 'GET' });
  }
}
