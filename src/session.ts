import type { RailScore } from './client';
import type {
  EvaluationResult,
  EvaluationMode,
  SessionConfig,
  SessionMetrics,
} from './types';

/**
 * Default session configuration values
 */
const SESSION_DEFAULTS: Required<SessionConfig> = {
  deepEvalFrequency: 5,
  contextWindow: 10,
  qualityThreshold: 7.0,
};

/**
 * Multi-turn session manager for tracking RAIL scores across conversation turns.
 *
 * Automatically manages evaluation depth (basic vs deep) based on turn count
 * and quality dips. Maintains a sliding window of recent evaluations for metrics.
 *
 * @example
 * ```typescript
 * const session = new RAILSession(client, {
 *   deepEvalFrequency: 5,
 *   qualityThreshold: 7.0
 * });
 *
 * // Evaluate each turn
 * const result = await session.addTurn('Response content here');
 * console.log(`Turn ${session.getTurnCount()} score: ${result.railScore.score}`);
 *
 * // Get session metrics
 * const metrics = session.getMetrics();
 * console.log(`Average score: ${metrics.averageScore}`);
 * ```
 */
export class RAILSession {
  private client: RailScore;
  private config: Required<SessionConfig>;
  private history: EvaluationResult[] = [];

  /**
   * Create a new RAIL session
   *
   * @param client - RailScore client instance
   * @param config - Optional session configuration
   */
  constructor(client: RailScore, config?: SessionConfig) {
    this.client = client;
    this.config = {
      deepEvalFrequency: config?.deepEvalFrequency ?? SESSION_DEFAULTS.deepEvalFrequency,
      contextWindow: config?.contextWindow ?? SESSION_DEFAULTS.contextWindow,
      qualityThreshold: config?.qualityThreshold ?? SESSION_DEFAULTS.qualityThreshold,
    };
  }

  /**
   * Add a conversation turn and evaluate it
   *
   * Automatically selects evaluation mode:
   * - Uses 'deep' mode every N turns (based on deepEvalFrequency)
   * - Uses 'deep' mode when the last turn scored below qualityThreshold
   * - Uses 'basic' mode otherwise
   *
   * @param content - The content of this turn
   * @param mode - Optional override for evaluation mode
   * @returns Promise resolving to evaluation result
   *
   * @example
   * ```typescript
   * const result = await session.addTurn('AI response to evaluate');
   * if (result.railScore.score < 7.0) {
   *   console.warn('Quality dip detected');
   * }
   * ```
   */
  async addTurn(content: string, mode?: EvaluationMode): Promise<EvaluationResult> {
    const selectedMode = mode || this.determineMode();

    const result = await this.client.evaluation.basic(content, undefined, {
      mode: selectedMode,
    });

    this.history.push(result);

    return result;
  }

  /**
   * Get aggregate metrics for the session
   *
   * @returns Session metrics including averages, min, max, and passing rate
   *
   * @example
   * ```typescript
   * const metrics = session.getMetrics();
   * console.log(`Avg: ${metrics.averageScore}, Passing: ${metrics.passingRate}%`);
   * ```
   */
  getMetrics(): SessionMetrics {
    if (this.history.length === 0) {
      return {
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        turnCount: 0,
        dimensionAverages: {},
        passingRate: 0,
      };
    }

    const scores = this.history.map(r => r.railScore.score);
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    const passingCount = scores.filter(s => s >= this.config.qualityThreshold).length;

    // Compute per-dimension averages
    const dimTotals: Record<string, { total: number; count: number }> = {};
    for (const result of this.history) {
      for (const [dim, dimScore] of Object.entries(result.scores)) {
        if (!dimTotals[dim]) {
          dimTotals[dim] = { total: 0, count: 0 };
        }
        dimTotals[dim].total += dimScore.score;
        dimTotals[dim].count += 1;
      }
    }

    const dimensionAverages: Record<string, number> = {};
    for (const [dim, data] of Object.entries(dimTotals)) {
      dimensionAverages[dim] = data.total / data.count;
    }

    return {
      averageScore: totalScore / this.history.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      turnCount: this.history.length,
      dimensionAverages,
      passingRate: (passingCount / this.history.length) * 100,
    };
  }

  /**
   * Get the total number of turns in this session
   */
  getTurnCount(): number {
    return this.history.length;
  }

  /**
   * Get the full evaluation history for this session
   *
   * @returns Array of evaluation results for all turns
   */
  getHistory(): EvaluationResult[] {
    return [...this.history];
  }

  /**
   * Reset the session, clearing all history
   */
  reset(): void {
    this.history = [];
  }

  /**
   * Determine the evaluation mode for the next turn
   * @internal
   */
  private determineMode(): EvaluationMode {
    const turnNumber = this.history.length + 1;

    // Every N turns, do a deep evaluation
    if (turnNumber % this.config.deepEvalFrequency === 0) {
      return 'deep';
    }

    // If last turn scored below threshold, do deep eval
    if (this.history.length > 0) {
      const lastScore = this.history[this.history.length - 1].railScore.score;
      if (lastScore < this.config.qualityThreshold) {
        return 'deep';
      }
    }

    return 'basic';
  }
}
