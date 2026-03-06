import type { RailScore } from './client';
import type {
  EvalResult,
  EvaluationMode,
  SessionConfig,
  SessionMetrics,
} from './types';

const SESSION_DEFAULTS: Required<SessionConfig> = {
  deepEvalFrequency: 5,
  contextWindow: 10,
  qualityThreshold: 7.0,
};

/**
 * Multi-turn session manager for tracking RAIL scores across conversation turns.
 *
 * @example
 * ```typescript
 * const session = new RAILSession(client, {
 *   deepEvalFrequency: 5,
 *   qualityThreshold: 7.0,
 * });
 *
 * const result = await session.addTurn('Response content here');
 * console.log(`Turn ${session.getTurnCount()} score: ${result.rail_score.score}`);
 *
 * const metrics = session.getMetrics();
 * console.log(`Average score: ${metrics.averageScore}`);
 * ```
 */
export class RAILSession {
  private client: RailScore;
  private config: Required<SessionConfig>;
  private history: EvalResult[] = [];

  constructor(client: RailScore, config?: SessionConfig) {
    this.client = client;
    this.config = {
      deepEvalFrequency: config?.deepEvalFrequency ?? SESSION_DEFAULTS.deepEvalFrequency,
      contextWindow: config?.contextWindow ?? SESSION_DEFAULTS.contextWindow,
      qualityThreshold: config?.qualityThreshold ?? SESSION_DEFAULTS.qualityThreshold,
    };
  }

  async addTurn(content: string, mode?: EvaluationMode): Promise<EvalResult> {
    const selectedMode = mode || this.determineMode();
    const result = await this.client.eval({ content, mode: selectedMode });
    this.history.push(result);
    return result;
  }

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

    const scores = this.history.map(r => r.rail_score.score);
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    const passingCount = scores.filter(s => s >= this.config.qualityThreshold).length;

    const dimTotals: Record<string, { total: number; count: number }> = {};
    for (const result of this.history) {
      for (const [dim, dimScore] of Object.entries(result.dimension_scores)) {
        if (!dimTotals[dim]) dimTotals[dim] = { total: 0, count: 0 };
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

  getTurnCount(): number {
    return this.history.length;
  }

  getHistory(): EvalResult[] {
    return [...this.history];
  }

  reset(): void {
    this.history = [];
  }

  private determineMode(): EvaluationMode {
    const turnNumber = this.history.length + 1;

    if (turnNumber % this.config.deepEvalFrequency === 0) {
      return 'deep';
    }

    if (this.history.length > 0) {
      const lastScore = this.history[this.history.length - 1].rail_score.score;
      if (lastScore < this.config.qualityThreshold) {
        return 'deep';
      }
    }

    return 'basic';
  }
}
