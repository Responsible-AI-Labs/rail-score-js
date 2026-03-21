import type { RailScore } from '../client';
import type { EvalResult, EvaluationMode } from '../types';
import { RAILBlockedError } from '../errors';

export interface RAILGeminiConfig {
  thresholds?: Record<string, number>;
  /**
   * Set to true when using a Vertex AI Gemini client instead of the standard
   * @google/generative-ai SDK. This is metadata only — instantiate the Vertex AI
   * client yourself and pass it as `modelInstance`.
   */
  useVertexAI?: boolean;
}

export interface RAILGeminiResponse {
  response: any;
  content: string;
  railScore: EvalResult['rail_score'];
  evaluation: EvalResult;
  /** Whether the content was regenerated to meet thresholds */
  wasRegenerated: boolean;
  /** The original pre-regeneration content (undefined if not regenerated) */
  originalContent?: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Wrapper around Google Generative AI client that automatically evaluates responses with RAIL Score.
 *
 * @example
 * ```typescript
 * const railGemini = new RAILGemini(client, model, { thresholds: { safety: 7.0 } });
 * const result = await railGemini.generate('Tell me about AI safety');
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILGemini {
  private client: RailScore;
  private model: any;
  private config: RAILGeminiConfig;

  constructor(client: RailScore, modelInstance: any, config?: RAILGeminiConfig) {
    this.client = client;
    this.model = modelInstance;
    this.config = config || {};
  }

  async generate(
    params: any & { railMode?: EvaluationMode; railSkip?: boolean }
  ): Promise<RAILGeminiResponse> {
    const { railMode, railSkip, ...geminiParams } = params;

    const response = await this.model.generateContent(geminiParams);

    let content = '';
    try {
      const result = response.response || response;
      content = result.text?.() || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch {
      content = '';
    }

    // Gemini token counts live on the response object
    const promptTokens =
      response.response?.usageMetadata?.promptTokenCount ??
      response.usageMetadata?.promptTokenCount ??
      0;
    const completionTokens =
      response.response?.usageMetadata?.candidatesTokenCount ??
      response.usageMetadata?.candidatesTokenCount ??
      0;
    const usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    };

    if (railSkip || !content) {
      const emptyEval: EvalResult = {
        rail_score: { score: 0, confidence: 0, summary: '' },
        explanation: '',
        dimension_scores: {},
        from_cache: false,
      };
      return {
        response,
        content: content || '',
        railScore: emptyEval.rail_score,
        evaluation: emptyEval,
        wasRegenerated: false,
        originalContent: undefined,
        usage,
      };
    }

    const evaluation = await this.client.eval({
      content,
      ...(railMode && { mode: railMode }),
    });

    if (this.config.thresholds) {
      const failed: string[] = [];
      for (const [dim, threshold] of Object.entries(this.config.thresholds)) {
        const score = evaluation.dimension_scores[dim];
        if (score && score.score < threshold) {
          failed.push(dim);
        }
      }

      if (failed.length > 0) {
        throw new RAILBlockedError(
          `Gemini response blocked: dimensions [${failed.join(', ')}] below threshold`,
          'BLOCK',
          evaluation.dimension_scores
        );
      }
    }

    return {
      response,
      content,
      railScore: evaluation.rail_score,
      evaluation,
      wasRegenerated: false,
      originalContent: undefined,
      usage,
    };
  }
}
