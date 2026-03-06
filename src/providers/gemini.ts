import type { RailScore } from '../client';
import type { EvalResult } from '../types';
import { RAILBlockedError } from '../errors';

export interface RAILGeminiConfig {
  thresholds?: Record<string, number>;
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

  async generate(params: any): Promise<{
    response: any;
    content: string;
    railScore: EvalResult['rail_score'];
    evaluation: EvalResult;
  }> {
    const response = await this.model.generateContent(params);

    let content = '';
    try {
      const result = response.response || response;
      content = result.text?.() || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch {
      content = '';
    }

    if (!content) {
      const emptyEval: EvalResult = {
        rail_score: { score: 0, confidence: 0, summary: '' },
        explanation: '',
        dimension_scores: {},
        from_cache: false,
      };
      return { response, content: '', railScore: emptyEval.rail_score, evaluation: emptyEval };
    }

    const evaluation = await this.client.eval({ content });

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

    return { response, content, railScore: evaluation.rail_score, evaluation };
  }
}
