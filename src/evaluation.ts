import type { RailScore } from './client';
import type {
  EvaluationResult,
  BatchEvaluationResult,
  RagEvaluationResult,
  Dimension,
  DimensionInput,
  DimensionScore,
  BatchItem,
  ContextChunk,
  EvaluationMode,
  ProtectedEvaluationResult,
  ProtectedRegenerateResult,
} from './types';
import { ValidationError } from './errors';
import { normalizeDimensionName, normalizeWeightsTo100 } from './utils';

/**
 * Evaluation API methods for scoring content with RAIL Score
 */
export class Evaluation {
  constructor(private client: RailScore) {}

  /**
   * Normalize a dimension input, mapping deprecated names
   * @internal
   */
  private normalizeDimension(dim: DimensionInput): Dimension {
    return normalizeDimensionName(dim);
  }

  /**
   * Normalize weights for API calls (auto-convert sum-to-100 to sum-to-1.0)
   * @internal
   */
  private normalizeWeightsForAPI(weights?: Record<string, number>): Record<string, number> | undefined {
    if (!weights) return undefined;
    return normalizeWeightsTo100(weights);
  }

  /**
   * Perform basic evaluation on content
   *
   * Evaluates content across all default dimensions and returns a comprehensive RAIL Score.
   *
   * @param content - The content to evaluate
   * @param weights - Optional custom weights for dimensions (must sum to 1.0 or 100)
   * @param options - Optional evaluation options (mode, domain, usecase)
   * @returns Promise resolving to evaluation result
   * @throws {ValidationError} If content is empty or invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {InsufficientCreditsError} If insufficient credits
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.basic(
   *   'Our AI system prioritizes user privacy and data security.',
   *   undefined,
   *   { mode: 'deep', domain: 'healthcare' }
   * );
   * console.log(`RAIL Score: ${result.railScore.score}/10`);
   * ```
   */
  async basic(
    content: string,
    weights?: Record<string, number>,
    options?: { mode?: EvaluationMode; domain?: string; usecase?: string }
  ): Promise<EvaluationResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    return this.client.request<EvaluationResult>('/v1/evaluation/basic', {
      method: 'POST',
      body: JSON.stringify({
        content,
        weights: this.normalizeWeightsForAPI(weights),
        ...(options?.mode && { mode: options.mode }),
        ...(options?.domain && { domain: options.domain }),
        ...(options?.usecase && { usecase: options.usecase }),
      }),
    });
  }

  /**
   * Evaluate content on a specific dimension
   *
   * Returns detailed scoring for a single dimension with explanation and issues.
   * Accepts deprecated 'legal_compliance' dimension name (auto-maps to 'inclusivity').
   *
   * @param content - The content to evaluate
   * @param dimension - The dimension to evaluate (accepts 'legal_compliance' for backward compat)
   * @returns Promise resolving to dimension score details
   * @throws {ValidationError} If content or dimension is invalid
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.dimension(
   *   'Your content here',
   *   'privacy'
   * );
   * console.log(`Privacy Score: ${result.score}/10`);
   * ```
   */
  async dimension(
    content: string,
    dimension: DimensionInput
  ): Promise<DimensionScore> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!dimension) {
      throw new ValidationError('Dimension is required');
    }

    const normalizedDimension = this.normalizeDimension(dimension);

    const response = await this.client.request<{ score: DimensionScore }>(
      '/v1/evaluation/dimension',
      {
        method: 'POST',
        body: JSON.stringify({ content, dimension: normalizedDimension }),
      }
    );

    return response.score;
  }

  /**
   * Perform custom evaluation with specific dimensions
   *
   * Allows you to evaluate only specific dimensions of interest.
   * Accepts deprecated 'legal_compliance' dimension name (auto-maps to 'inclusivity').
   *
   * @param content - The content to evaluate
   * @param dimensions - Array of dimensions to evaluate
   * @param weights - Optional custom weights for the selected dimensions
   * @returns Promise resolving to evaluation result
   * @throws {ValidationError} If content or dimensions are invalid
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.custom(
   *   'Your content here',
   *   ['safety', 'privacy', 'fairness'],
   *   { safety: 0.5, privacy: 0.3, fairness: 0.2 }
   * );
   * ```
   */
  async custom(
    content: string,
    dimensions: DimensionInput[],
    weights?: Record<string, number>
  ): Promise<EvaluationResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!dimensions || dimensions.length === 0) {
      throw new ValidationError('At least one dimension is required');
    }

    const normalizedDimensions = dimensions.map(d => this.normalizeDimension(d));

    return this.client.request<EvaluationResult>('/v1/evaluation/custom', {
      method: 'POST',
      body: JSON.stringify({
        content,
        dimensions: normalizedDimensions,
        weights: this.normalizeWeightsForAPI(weights),
      }),
    });
  }

  /**
   * Perform batch evaluation on multiple items
   *
   * Efficiently evaluate multiple content items in a single request.
   *
   * @param items - Array of items to evaluate (content strings or BatchItem objects)
   * @param dimensions - Optional array of dimensions to evaluate
   * @param tier - Service tier to use (default: 'balanced')
   * @returns Promise resolving to batch evaluation results
   * @throws {ValidationError} If items array is empty or invalid
   *
   * @example
   * ```typescript
   * const results = await client.evaluation.batch([
   *   { content: 'First item', id: 'item-1' },
   *   { content: 'Second item', id: 'item-2' }
   * ]);
   * console.log(`Processed: ${results.successful}/${results.totalItems}`);
   * ```
   */
  async batch(
    items: Array<string | BatchItem>,
    dimensions?: DimensionInput[],
    tier: 'fast' | 'balanced' | 'advanced' = 'balanced'
  ): Promise<BatchEvaluationResult> {
    if (!items || items.length === 0) {
      throw new ValidationError('Items array cannot be empty');
    }

    // Normalize items to BatchItem format
    const normalizedItems: BatchItem[] = items.map((item, index) => {
      if (typeof item === 'string') {
        return { content: item, id: `item-${index}` };
      }
      return item;
    });

    // Validate all items have content
    for (const item of normalizedItems) {
      if (!item.content || item.content.trim().length === 0) {
        throw new ValidationError(
          `Item ${item.id || 'unknown'} has empty content`
        );
      }
    }

    const normalizedDimensions = dimensions?.map(d => this.normalizeDimension(d));

    return this.client.request<BatchEvaluationResult>('/v1/evaluation/batch', {
      method: 'POST',
      body: JSON.stringify({
        items: normalizedItems,
        dimensions: normalizedDimensions,
        tier,
      }),
    });
  }

  /**
   * Evaluate RAG (Retrieval-Augmented Generation) response quality
   *
   * Assesses the quality of a RAG system response including context relevance,
   * answer faithfulness, and answer relevance.
   *
   * @param query - The user's query
   * @param response - The generated response
   * @param contextChunks - Array of retrieved context chunks
   * @returns Promise resolving to RAG evaluation result
   * @throws {ValidationError} If query, response, or context is invalid
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.ragEvaluate(
   *   'What is GDPR?',
   *   'GDPR is a regulation in EU law...',
   *   [
   *     { content: 'GDPR stands for General Data Protection Regulation...' },
   *     { content: 'It was implemented in May 2018...' }
   *   ]
   * );
   * console.log(`RAG Score: ${result.ragScore.score}/10`);
   * ```
   */
  async ragEvaluate(
    query: string,
    response: string,
    contextChunks: ContextChunk[]
  ): Promise<RagEvaluationResult> {
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Query cannot be empty');
    }

    if (!response || response.trim().length === 0) {
      throw new ValidationError('Response cannot be empty');
    }

    if (!contextChunks || contextChunks.length === 0) {
      throw new ValidationError('At least one context chunk is required');
    }

    // Validate all context chunks have content
    for (let i = 0; i < contextChunks.length; i++) {
      if (!contextChunks[i].content || contextChunks[i].content.trim().length === 0) {
        throw new ValidationError(`Context chunk ${i} has empty content`);
      }
    }

    return this.client.request<RagEvaluationResult>('/v1/evaluation/rag', {
      method: 'POST',
      body: JSON.stringify({
        query,
        response,
        context_chunks: contextChunks,
      }),
    });
  }

  /**
   * Evaluate content with protection thresholds
   *
   * Evaluates content and checks if it passes minimum score thresholds.
   * Returns pass/fail status along with failed dimensions.
   *
   * @param content - The content to evaluate
   * @param threshold - Minimum acceptable score per dimension (default: 7.0)
   * @param mode - Evaluation mode (default: 'basic')
   * @returns Promise resolving to protected evaluation result
   * @throws {ValidationError} If content is empty
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.protectedEvaluate(
   *   'Content to check',
   *   7.0,
   *   'deep'
   * );
   * if (!result.passed) {
   *   console.log('Failed dimensions:', result.failedDimensions);
   * }
   * ```
   */
  async protectedEvaluate(
    content: string,
    threshold: number = 7.0,
    mode: EvaluationMode = 'basic'
  ): Promise<ProtectedEvaluationResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    return this.client.request<ProtectedEvaluationResult>(
      '/v1/evaluation/protected',
      {
        method: 'POST',
        body: JSON.stringify({ content, threshold, mode }),
      }
    );
  }

  /**
   * Regenerate content to fix identified issues
   *
   * Takes content that failed protection thresholds and regenerates it
   * with the specified issues fixed.
   *
   * @param content - The content to regenerate
   * @param issuesToFix - Array of issues to address in regeneration
   * @returns Promise resolving to regenerated content result
   * @throws {ValidationError} If content or issues are empty
   *
   * @example
   * ```typescript
   * const result = await client.evaluation.protectedRegenerate(
   *   'Content with issues',
   *   ['Bias in language', 'Missing safety disclaimers']
   * );
   * console.log('Fixed content:', result.content);
   * console.log('Fixed issues:', result.fixedIssues);
   * ```
   */
  async protectedRegenerate(
    content: string,
    issuesToFix: string[]
  ): Promise<ProtectedRegenerateResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!issuesToFix || issuesToFix.length === 0) {
      throw new ValidationError('At least one issue to fix is required');
    }

    return this.client.request<ProtectedRegenerateResult>(
      '/v1/evaluation/protected/regenerate',
      {
        method: 'POST',
        body: JSON.stringify({ content, issues_to_fix: issuesToFix }),
      }
    );
  }
}
