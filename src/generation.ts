import type { RailScore } from './client';
import type {
  GenerationResult,
  GenerationOptions,
  Dimension,
} from './types';
import { ValidationError } from './errors';

/**
 * Generation API methods for creating responsible AI content
 */
export class Generation {
  constructor(private client: RailScore) {}

  /**
   * Generate content optimized for high RAIL Score
   *
   * Creates content that meets specified responsible AI criteria.
   *
   * @param prompt - The generation prompt
   * @param options - Generation options
   * @returns Promise resolving to generated content with RAIL Score
   * @throws {ValidationError} If prompt is invalid
   * @throws {AuthenticationError} If API key is invalid
   * @throws {InsufficientCreditsError} If insufficient credits
   *
   * @example
   * ```typescript
   * const result = await client.generation.generate(
   *   'Write a privacy policy for a mobile app',
   *   {
   *     targetScore: 9.0,
   *     dimensions: ['privacy', 'transparency', 'legal_compliance'],
   *     maxIterations: 3
   *   }
   * );
   * console.log(result.content);
   * console.log(`Score: ${result.railScore.score}/10`);
   * ```
   */
  async generate(
    prompt: string,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    if (!prompt || prompt.trim().length === 0) {
      throw new ValidationError('Prompt cannot be empty');
    }

    // Validate targetScore if provided
    if (options?.targetScore !== undefined) {
      if (options.targetScore < 0 || options.targetScore > 10) {
        throw new ValidationError('Target score must be between 0 and 10');
      }
    }

    // Validate maxIterations if provided
    if (options?.maxIterations !== undefined) {
      if (options.maxIterations < 1 || options.maxIterations > 10) {
        throw new ValidationError('Max iterations must be between 1 and 10');
      }
    }

    // Validate temperature if provided
    if (options?.temperature !== undefined) {
      if (options.temperature < 0 || options.temperature > 2) {
        throw new ValidationError('Temperature must be between 0 and 2');
      }
    }

    return this.client.request<GenerationResult>('/v1/generation/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        target_score: options?.targetScore,
        dimensions: options?.dimensions,
        max_iterations: options?.maxIterations,
        temperature: options?.temperature,
      }),
    });
  }

  /**
   * Improve existing content to achieve higher RAIL Score
   *
   * Analyzes and enhances content to better meet responsible AI standards.
   *
   * @param content - The content to improve
   * @param targetDimensions - Optional dimensions to focus improvement on
   * @param targetScore - Optional target score to achieve (default: 8.0)
   * @returns Promise resolving to improved content with RAIL Score
   * @throws {ValidationError} If content is invalid
   *
   * @example
   * ```typescript
   * const result = await client.generation.improve(
   *   'Our AI collects user data for analysis.',
   *   ['privacy', 'transparency'],
   *   9.0
   * );
   * console.log('Improved content:', result.content);
   * console.log(`Score improved to: ${result.railScore.score}/10`);
   * ```
   */
  async improve(
    content: string,
    targetDimensions?: Dimension[],
    targetScore: number = 8.0
  ): Promise<GenerationResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (targetScore < 0 || targetScore > 10) {
      throw new ValidationError('Target score must be between 0 and 10');
    }

    return this.client.request<GenerationResult>('/v1/generation/improve', {
      method: 'POST',
      body: JSON.stringify({
        content,
        target_dimensions: targetDimensions,
        target_score: targetScore,
      }),
    });
  }

  /**
   * Rewrite content to fix specific issues
   *
   * Addresses identified problems in content while maintaining the core message.
   *
   * @param content - The content to rewrite
   * @param issues - Array of issues to address
   * @param preserveTone - Whether to preserve the original tone (default: true)
   * @returns Promise resolving to rewritten content with RAIL Score
   * @throws {ValidationError} If content or issues are invalid
   *
   * @example
   * ```typescript
   * const result = await client.generation.rewrite(
   *   'We may share your data with partners.',
   *   ['Lacks transparency about data sharing', 'No user consent mentioned'],
   *   true
   * );
   * console.log('Rewritten:', result.content);
   * ```
   */
  async rewrite(
    content: string,
    issues: string[],
    preserveTone: boolean = true
  ): Promise<GenerationResult> {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Content cannot be empty');
    }

    if (!issues || issues.length === 0) {
      throw new ValidationError('At least one issue is required');
    }

    // Validate all issues are non-empty strings
    for (const issue of issues) {
      if (!issue || issue.trim().length === 0) {
        throw new ValidationError('Issues cannot contain empty strings');
      }
    }

    return this.client.request<GenerationResult>('/v1/generation/rewrite', {
      method: 'POST',
      body: JSON.stringify({
        content,
        issues,
        preserve_tone: preserveTone,
      }),
    });
  }

  /**
   * Generate content variations optimized for different dimensions
   *
   * Creates multiple versions of content, each optimized for specific dimensions.
   *
   * @param prompt - The generation prompt
   * @param dimensionSets - Array of dimension sets to optimize for
   * @param count - Number of variations per dimension set (default: 1)
   * @returns Promise resolving to array of generated variations
   * @throws {ValidationError} If prompt or dimension sets are invalid
   *
   * @example
   * ```typescript
   * const results = await client.generation.variations(
   *   'Describe our AI moderation system',
   *   [
   *     ['safety', 'transparency'],
   *     ['privacy', 'accountability'],
   *   ],
   *   2
   * );
   * // Returns multiple variations optimized for different dimension combinations
   * ```
   */
  async variations(
    prompt: string,
    dimensionSets: Dimension[][],
    count: number = 1
  ): Promise<GenerationResult[]> {
    if (!prompt || prompt.trim().length === 0) {
      throw new ValidationError('Prompt cannot be empty');
    }

    if (!dimensionSets || dimensionSets.length === 0) {
      throw new ValidationError('At least one dimension set is required');
    }

    if (count < 1 || count > 5) {
      throw new ValidationError('Count must be between 1 and 5');
    }

    // Validate dimension sets
    for (const dimSet of dimensionSets) {
      if (!dimSet || dimSet.length === 0) {
        throw new ValidationError('Each dimension set must contain at least one dimension');
      }
    }

    const response = await this.client.request<{ variations: GenerationResult[] }>(
      '/v1/generation/variations',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          dimension_sets: dimensionSets,
          count,
        }),
      }
    );

    return response.variations;
  }
}
