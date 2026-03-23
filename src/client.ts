import fetch, { Response, RequestInit } from 'node-fetch';
import type {
  RailScoreConfig,
  EvalParams,
  EvalResult,
  SafeRegenerateParams,
  SafeRegenerateContinueParams,
  SafeRegenerateResult,
  ComplianceCheckParams,
  ComplianceCheckSingleParams,
  ComplianceCheckMultiParams,
  ComplianceResult,
  MultiComplianceResult,
  HealthCheckResponse,
} from './types';
import {
  AuthenticationError,
  InsufficientCreditsError,
  InsufficientTierError,
  RateLimitError,
  ValidationError,
  RailScoreError,
  TimeoutError,
  NetworkError,
  ServiceUnavailableError,
  SessionExpiredError,
  ContentTooHarmfulError,
  EvaluationFailedError,
  NotImplementedByServerError,
  ServerError,
} from './errors';
import { resolveFrameworkAlias, validateWeightsSum100 } from './utils';
import { AgentNamespace } from './agent';

const DEFAULT_TIMEOUT = 30000;
const SAFE_REGENERATE_TIMEOUT = 120000;
const SDK_VERSION = '2.4.0';
const AGENT_TOOL_CALL_ENDPOINT = '/railscore/v1/agent/tool-call';

const RETRY_STATUSES = [429, 500, 502, 503];
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Main RailScore client for interacting with the RAIL Score API.
 *
 * @example
 * ```typescript
 * const client = new RailScore({ apiKey: process.env.RAIL_API_KEY! });
 *
 * const result = await client.eval({ content: 'Your content here' });
 * console.log(`Score: ${result.rail_score.score}/10`);
 * ```
 */
export class RailScore {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly cacheEnabled: boolean;
  private readonly retryEnabled: boolean;
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Agent evaluation namespace.
   *
   * Provides pre-call tool evaluation, post-call result scanning, prompt
   * injection detection, plan evaluation, and tool risk registry management.
   *
   * @example
   * ```typescript
   * const decision = await client.agent.evaluateToolCall({
   *   toolName: 'credit_scoring_api',
   *   toolParams: { zipCode: '90210', loanAmount: 50000 },
   *   domain: 'finance',
   *   complianceFrameworks: ['eu_ai_act', 'gdpr'],
   * });
   * ```
   */
  readonly agent: AgentNamespace;

  constructor(config: RailScoreConfig) {
    if (!config.apiKey) {
      throw new ValidationError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.responsibleailabs.ai';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.cacheEnabled = config.cache ?? false;
    this.retryEnabled = config.retry ?? false;
    this.agent = new AgentNamespace(this);
  }

  private buildCacheKey(endpoint: string, options: RequestInit): string {
    const body = options.body || '';
    // Sort JSON keys for stable cache key
    let normalizedBody = body;
    if (typeof body === 'string' && body.length > 0) {
      try {
        const parsed = JSON.parse(body);
        const sorted = Object.keys(parsed)
          .sort()
          .reduce((acc: Record<string, unknown>, k) => {
            acc[k] = parsed[k];
            return acc;
          }, {});
        normalizedBody = JSON.stringify(sorted);
      } catch {
        normalizedBody = body;
      }
    }
    return `${endpoint}:${normalizedBody}`;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCached<T>(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  /**
   * Evaluate content across 8 RAIL dimensions.
   *
   * POST /railscore/v1/eval
   *
   * @param params - Evaluation parameters
   * @returns Evaluation result with rail_score, dimension_scores, and optional explanations
   *
   * @example
   * ```typescript
   * // Basic evaluation
   * const result = await client.eval({
   *   content: 'AI should prioritize human welfare and safety.',
   * });
   * console.log(`RAIL Score: ${result.rail_score.score}/10`);
   *
   * // Deep evaluation with options
   * const deep = await client.eval({
   *   content: 'Take 500mg of ibuprofen every 4 hours.',
   *   mode: 'deep',
   *   domain: 'healthcare',
   *   dimensions: ['safety', 'reliability'],
   *   includeSuggestions: true,
   * });
   * ```
   */
  async eval(params: EvalParams): Promise<EvalResult> {
    if (!params.content || params.content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (params.weights) {
      validateWeightsSum100(params.weights);
    }

    return this.request<EvalResult>('/railscore/v1/eval', {
      method: 'POST',
      body: JSON.stringify({
        content: params.content,
        ...(params.mode && { mode: params.mode }),
        ...(params.dimensions && { dimensions: params.dimensions }),
        ...(params.weights && { weights: params.weights }),
        ...(params.context && { context: params.context }),
        ...(params.domain && { domain: params.domain }),
        ...(params.usecase && { usecase: params.usecase }),
        ...(params.includeExplanations !== undefined && { include_explanations: params.includeExplanations }),
        ...(params.includeIssues !== undefined && { include_issues: params.includeIssues }),
        ...(params.includeSuggestions !== undefined && { include_suggestions: params.includeSuggestions }),
      }),
    });
  }

  /**
   * Evaluate content and iteratively regenerate until quality thresholds are met.
   *
   * POST /railscore/v1/safe-regenerate
   *
   * Two modes:
   * - Server-side ("RAIL_Safe_LLM"): Server evaluates + regenerates in a loop.
   * - Client-orchestrated ("external"): Server evaluates, returns prompt.
   *   Client regenerates with own LLM, then calls safeRegenerateContinue().
   *
   * @param params - Safe regenerate parameters
   * @returns Result with status, best_content, iteration_history, or session info for external mode
   *
   * @example
   * ```typescript
   * // Server-side mode
   * const result = await client.safeRegenerate({
   *   content: 'Our AI system collects user data. We use it for stuff.',
   *   mode: 'basic',
   *   maxRegenerations: 2,
   *   regenerationModel: 'RAIL_Safe_LLM',
   *   thresholds: { overall: { score: 8.0, confidence: 0.5 } },
   * });
   * console.log(result.status);       // "passed" or "max_iterations_reached"
   * console.log(result.best_content);
   *
   * // External mode
   * const ext = await client.safeRegenerate({
   *   content: 'Content to improve',
   *   regenerationModel: 'external',
   *   maxRegenerations: 1,
   * });
   * // ext.status === "awaiting_regeneration"
   * // Use ext.rail_prompt with your own LLM, then call safeRegenerateContinue()
   * ```
   */
  async safeRegenerate(params: SafeRegenerateParams): Promise<SafeRegenerateResult> {
    if (!params.content || params.content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (params.weights) {
      validateWeightsSum100(params.weights);
    }

    return this.request<SafeRegenerateResult>(
      '/railscore/v1/safe-regenerate',
      {
        method: 'POST',
        body: JSON.stringify({
          content: params.content,
          ...(params.mode && { mode: params.mode }),
          ...(params.maxRegenerations !== undefined && { max_regenerations: params.maxRegenerations }),
          ...(params.regenerationModel && { regeneration_model: params.regenerationModel }),
          ...(params.thresholds && { thresholds: params.thresholds }),
          ...(params.context && { context: params.context }),
          ...(params.domain && { domain: params.domain }),
          ...(params.usecase && { usecase: params.usecase }),
          ...(params.userQuery && { user_query: params.userQuery }),
          ...(params.weights && { weights: params.weights }),
          ...(params.policyHint && { policy_hint: params.policyHint }),
        }),
      },
      SAFE_REGENERATE_TIMEOUT
    );
  }

  /**
   * Continue an external-mode safe-regenerate session.
   *
   * POST /railscore/v1/safe-regenerate/continue
   *
   * @param params - Session ID and regenerated content
   * @returns Updated result (may be "passed", "awaiting_regeneration", or "max_iterations_reached")
   * @throws {SessionExpiredError} If session has expired (15 min TTL)
   *
   * @example
   * ```typescript
   * const continued = await client.safeRegenerateContinue({
   *   sessionId: ext.session_id!,
   *   regeneratedContent: improvedContent,
   * });
   * console.log(continued.status);
   * ```
   */
  async safeRegenerateContinue(params: SafeRegenerateContinueParams): Promise<SafeRegenerateResult> {
    if (!params.sessionId) {
      throw new ValidationError('Session ID is required');
    }

    if (!params.regeneratedContent || params.regeneratedContent.trim().length === 0) {
      throw new ValidationError('Regenerated content cannot be empty');
    }

    return this.request<SafeRegenerateResult>(
      '/railscore/v1/safe-regenerate/continue',
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: params.sessionId,
          regenerated_content: params.regeneratedContent,
        }),
      },
      SAFE_REGENERATE_TIMEOUT
    );
  }

  /**
   * Check content compliance against a single regulatory framework.
   *
   * POST /railscore/v1/compliance/check
   *
   * @param params - Compliance check parameters with `framework` (single)
   * @returns Single-framework compliance result
   */
  complianceCheck(params: ComplianceCheckSingleParams): Promise<ComplianceResult>;

  /**
   * Check content compliance against multiple regulatory frameworks.
   *
   * POST /railscore/v1/compliance/check
   *
   * @param params - Compliance check parameters with `frameworks` (array)
   * @returns Multi-framework compliance result with cross_framework_summary
   */
  complianceCheck(params: ComplianceCheckMultiParams): Promise<MultiComplianceResult>;

  async complianceCheck(params: ComplianceCheckParams): Promise<ComplianceResult | MultiComplianceResult> {
    if (!params.content || params.content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    const body: Record<string, any> = {
      content: params.content,
    };

    if ('framework' in params && params.framework) {
      body.framework = resolveFrameworkAlias(params.framework);
    } else if ('frameworks' in params && params.frameworks) {
      if (params.frameworks.length === 0) {
        throw new ValidationError('At least one framework is required');
      }
      if (params.frameworks.length > 5) {
        throw new ValidationError('Maximum 5 frameworks allowed per request');
      }
      body.frameworks = params.frameworks.map(resolveFrameworkAlias);
    } else {
      throw new ValidationError('Either framework or frameworks is required');
    }

    if (params.context) {
      body.context = params.context;
    }
    if (params.strictMode !== undefined) {
      body.strict_mode = params.strictMode;
    }
    if (params.includeExplanations !== undefined) {
      body.include_explanations = params.includeExplanations;
    }

    return this.request<ComplianceResult | MultiComplianceResult>(
      '/railscore/v1/compliance/check',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Health check. No authentication required.
   *
   * GET /health
   *
   * @returns Health status with service name
   *
   * @example
   * ```typescript
   * const health = await client.health();
   * console.log(`Status: ${health.status}`);   // "healthy"
   * console.log(`Service: ${health.service}`);  // "rail-score-engine"
   * ```
   */
  async health(): Promise<HealthCheckResponse> {
    const url = `${this.baseUrl}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': `rail-score-js/${SDK_VERSION}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleError(response);
      }

      return await response.json() as HealthCheckResponse;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof RailScoreError) throw error;
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${this.timeout}ms`);
      }
      throw new NetworkError(`Network request failed: ${error.message}`, error);
    }
  }

  /**
   * Make an authenticated HTTP request to the API.
   *
   * Supports optional in-memory caching (5-minute TTL) and exponential backoff retry
   * on transient errors (429/500/502/503), both controlled by the client config.
   *
   * @internal
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customTimeout?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const effectiveTimeout = customTimeout || this.timeout;

    // Cache check — only for eval and health endpoints on success
    const isCacheable =
      this.cacheEnabled &&
      (endpoint === '/railscore/v1/eval' || endpoint === '/health');

    if (isCacheable) {
      const cacheKey = this.buildCacheKey(endpoint, options);
      const cached = this.getCached<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const maxAttempts = this.retryEnabled ? 4 : 1; // 1 initial + up to 3 retries
    let lastResponse: Response | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1])
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      try {
        lastResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': `rail-score-js/${SDK_VERSION}`,
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Retry on transient status codes (unless this is the last attempt)
        if (
          RETRY_STATUSES.includes(lastResponse.status) &&
          attempt < maxAttempts - 1
        ) {
          continue;
        }

        if (!lastResponse.ok) {
          await this.handleError(lastResponse);
        }

        const result = await lastResponse.json() as T;

        if (isCacheable) {
          const cacheKey = this.buildCacheKey(endpoint, options);
          this.setCached(cacheKey, result);
        }

        return result;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error instanceof RailScoreError) throw error;
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Request timeout after ${effectiveTimeout}ms`);
        }
        lastError = error;
        // Network errors: retry if attempts remain
        if (attempt < maxAttempts - 1) {
          continue;
        }
        throw new NetworkError(`Network request failed: ${error.message}`, error);
      }
    }

    // Should not reach here, but satisfy TypeScript
    if (lastError) {
      throw new NetworkError(`Network request failed: ${lastError.message}`, lastError);
    }
    throw new NetworkError('Request failed after retries', undefined);
  }

  /**
   * Make an authenticated HTTP request to the agent/tool-call endpoint.
   *
   * Identical to `request()` but intercepts HTTP 403 and returns the response
   * body as a BLOCK decision rather than throwing an AuthenticationError.
   * Any other 403 from other endpoints is still treated as an auth error.
   *
   * @internal
   */
  async requestAgentToolCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const effectiveTimeout = this.timeout;

    const maxAttempts = this.retryEnabled ? 4 : 1;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1])
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': `rail-score-js/${SDK_VERSION}`,
            ...options.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // HTTP 403 on the agent tool-call endpoint = BLOCK decision, not auth error.
        // Parse and return the body as normal; the decision field will be "BLOCK".
        if (response.status === 403 && endpoint === AGENT_TOOL_CALL_ENDPOINT) {
          return (await response.json()) as T;
        }

        if (
          RETRY_STATUSES.includes(response.status) &&
          attempt < maxAttempts - 1
        ) {
          continue;
        }

        if (!response.ok) {
          await this.handleError(response);
        }

        return (await response.json()) as T;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error instanceof RailScoreError) throw error;
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Request timeout after ${effectiveTimeout}ms`);
        }
        lastError = error;
        if (attempt < maxAttempts - 1) {
          continue;
        }
        throw new NetworkError(`Network request failed: ${error.message}`, error);
      }
    }

    if (lastError) {
      throw new NetworkError(`Network request failed: ${lastError.message}`, lastError);
    }
    throw new NetworkError('Request failed after retries', undefined);
  }

  /**
   * Handle API error responses.
   * @internal
   */
  private async handleError(response: Response): Promise<never> {
    const status = response.status;
    let errorData: any;

    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    if (!errorData || typeof errorData !== 'object') {
      errorData = { message: response.statusText };
    }

    const message = errorData.message || errorData.error || 'Unknown error';

    switch (status) {
      case 400:
        throw new ValidationError(message, errorData.field, errorData);

      case 401:
        throw new AuthenticationError(message, errorData);

      case 402:
        throw new InsufficientCreditsError(
          errorData.balance || 0,
          errorData.required || 0,
          errorData
        );

      case 403:
        throw new InsufficientTierError(
          errorData.required_tier || 'unknown',
          errorData.current_tier || 'unknown',
          errorData
        );

      case 410:
        throw new SessionExpiredError(message, errorData);

      case 422:
        throw new ContentTooHarmfulError(message, errorData);

      case 429:
        throw new RateLimitError(errorData.retry_after || 60, errorData);

      case 500:
        throw new EvaluationFailedError(message, errorData.req_id, errorData);

      case 501:
        throw new NotImplementedByServerError(message, errorData);

      case 503:
        throw new ServiceUnavailableError(message, errorData.retry_after, errorData);

      default:
        throw new RailScoreError(
          `Request failed with status ${status}: ${message}`,
          status,
          errorData
        );
    }
  }
}
