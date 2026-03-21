import type { RAILTelemetry } from './core';
import type { EvalResult } from '../types';

export interface ReviewItem {
  itemId: string;        // 'rev_' + 12-char hex
  dimension: string;
  score: number;
  threshold: number;
  orgId: string;
  projectId: string;
  environment: string;
  timestamp: string;     // ISO-8601 UTC
  contentPreview: string;
  explanation?: string;
  issues?: string[];
  incidentId?: string;
  metadata: Record<string, any>;
}

export interface HumanReviewQueueConfig {
  /** Score threshold below which items are enqueued (default: 7.0) */
  threshold?: number;
  orgId?: string;
  projectId?: string;
  environment?: string;
  telemetry?: RAILTelemetry;
}

function generateHex(length: number): string {
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Maintains a queue of content items flagged for human review based on low RAIL scores.
 *
 * @example
 * ```typescript
 * const queue = new HumanReviewQueue({ threshold: 7.0, orgId: 'org-123' });
 * const flagged = queue.checkAndEnqueue(evalResult, 'Content preview...');
 * console.log(`Flagged ${flagged.length} dimensions for review`);
 *
 * const pending = queue.pending();
 * const all = queue.drain();
 * ```
 */
export class HumanReviewQueue {
  private threshold: number;
  private orgId: string;
  private projectId: string;
  private environment: string;
  private telemetry: RAILTelemetry | undefined;
  private queue: ReviewItem[] = [];

  constructor(config: HumanReviewQueueConfig = {}) {
    this.threshold = config.threshold ?? 7.0;
    this.orgId = config.orgId ?? '';
    this.projectId = config.projectId ?? '';
    this.environment = config.environment ?? 'production';
    this.telemetry = config.telemetry;
  }

  /**
   * Checks each dimension score against the threshold and enqueues items that are below it.
   *
   * @param evalResult      Evaluation result from RailScore
   * @param contentPreview  Short preview of the evaluated content
   * @param options         Optional incident ID and extra metadata
   * @returns               Array of newly enqueued ReviewItems
   */
  checkAndEnqueue(
    evalResult: EvalResult,
    contentPreview: string,
    options?: {
      incidentId?: string;
      metadata?: Record<string, any>;
    }
  ): ReviewItem[] {
    const enqueued: ReviewItem[] = [];
    const timestamp = new Date().toISOString();

    for (const [dimension, dimScore] of Object.entries(evalResult.dimension_scores)) {
      if (dimScore.score < this.threshold) {
        const item: ReviewItem = {
          itemId: `rev_${generateHex(12)}`,
          dimension,
          score: dimScore.score,
          threshold: this.threshold,
          orgId: this.orgId,
          projectId: this.projectId,
          environment: this.environment,
          timestamp,
          contentPreview: contentPreview.slice(0, 200),
          explanation: dimScore.explanation,
          issues: dimScore.issues,
          incidentId: options?.incidentId,
          metadata: options?.metadata ?? {},
        };

        this.queue.push(item);
        enqueued.push(item);

        // Log each enqueued item as a span event if telemetry is available
        if (this.telemetry?.isAvailable) {
          this.telemetry
            .startSpan(
              'rail.review_queue.enqueue',
              async (span) => {
                if (span) {
                  span.setAttributes({
                    'rail.review.item_id': item.itemId,
                    'rail.review.dimension': dimension,
                    'rail.review.score': dimScore.score,
                    'rail.review.threshold': this.threshold,
                  });
                }
                return undefined;
              }
            )
            .catch(() => {
              // Non-fatal
            });
        }
      }
    }

    return enqueued;
  }

  /**
   * Returns pending review items, optionally filtered by dimension.
   *
   * @param dimension  If provided, only return items for this dimension
   */
  pending(dimension?: string): ReviewItem[] {
    if (dimension !== undefined) {
      return this.queue.filter((item) => item.dimension === dimension);
    }
    return [...this.queue];
  }

  /**
   * Returns all pending items and clears the queue.
   */
  drain(): ReviewItem[] {
    const all = [...this.queue];
    this.queue = [];
    return all;
  }

  /** Total number of pending items in the queue */
  size(): number {
    return this.queue.length;
  }

  /** Count of pending items broken down by dimension */
  sizeByDimension(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of this.queue) {
      counts[item.dimension] = (counts[item.dimension] ?? 0) + 1;
    }
    return counts;
  }
}
