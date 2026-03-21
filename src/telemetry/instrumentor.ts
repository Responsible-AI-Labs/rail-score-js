import type { RAILTelemetry } from './core';
import {
  ATTR_ENDPOINT,
  ATTR_MODE,
  ATTR_SCORE,
  ATTR_CONFIDENCE,
  ATTR_CREDITS_CONSUMED,
  ATTR_FROM_CACHE,
  METRIC_REQUESTS,
  METRIC_REQUEST_DURATION,
  METRIC_ERRORS,
  METRIC_SCORE_DISTRIBUTION,
} from './constants';

/**
 * RAILInstrumentor monkey-patches a RailScore client's `request` method to
 * automatically wrap every API call in an OTEL span and record metrics.
 *
 * If OTEL is unavailable, this class is a no-op.
 *
 * @example
 * ```typescript
 * const telemetry = new RAILTelemetry({ serviceName: 'my-service' });
 * const instrumentor = new RAILInstrumentor();
 * instrumentor.instrumentClient(client, telemetry);
 * ```
 */
export class RAILInstrumentor {
  /**
   * Monkey-patches `client.request` to wrap every call in an OTEL span
   * and record requests, duration, errors, and score metrics.
   *
   * @param client    A RailScore client instance
   * @param telemetry A RAILTelemetry instance
   */
  instrumentClient(client: any, telemetry: RAILTelemetry): void {
    if (!telemetry.isAvailable) {
      return;
    }

    const originalRequest = client.request.bind(client);

    client.request = async function (
      endpoint: string,
      options: any = {},
      customTimeout?: number
    ): Promise<any> {
      const startTime = Date.now();
      const spanName = `rail.request ${endpoint}`;

      const attributes: Record<string, string | number | boolean> = {
        [ATTR_ENDPOINT]: endpoint,
      };

      // Try to extract mode from body before starting span
      if (options?.body) {
        try {
          const body =
            typeof options.body === 'string'
              ? JSON.parse(options.body)
              : options.body;
          if (body.mode) {
            attributes[ATTR_MODE] = body.mode;
          }
        } catch {
          // ignore parse errors
        }
      }

      return telemetry.startSpan(
        spanName,
        async (span: any) => {
          if (span) {
            span.setAttributes(attributes);
          }

          telemetry.recordMetric(METRIC_REQUESTS, 1, { [ATTR_ENDPOINT]: endpoint });

          try {
            const result = await originalRequest(endpoint, options, customTimeout);
            const durationMs = Date.now() - startTime;

            // Record duration
            telemetry.recordMetric(METRIC_REQUEST_DURATION, durationMs, {
              [ATTR_ENDPOINT]: endpoint,
            });

            // Enrich span with response data if available
            if (result && span) {
              const resultAttributes: Record<string, string | number | boolean> = {};

              if (result.rail_score?.score !== undefined) {
                resultAttributes[ATTR_SCORE] = result.rail_score.score;
                telemetry.recordMetric(METRIC_SCORE_DISTRIBUTION, result.rail_score.score, {
                  [ATTR_ENDPOINT]: endpoint,
                });
              }
              if (result.rail_score?.confidence !== undefined) {
                resultAttributes[ATTR_CONFIDENCE] = result.rail_score.confidence;
              }
              if (result.credits_consumed !== undefined) {
                resultAttributes[ATTR_CREDITS_CONSUMED] = result.credits_consumed;
              }
              if (result.from_cache !== undefined) {
                resultAttributes[ATTR_FROM_CACHE] = result.from_cache;
              }

              if (Object.keys(resultAttributes).length > 0) {
                span.setAttributes(resultAttributes);
              }
            }

            return result;
          } catch (err: any) {
            const durationMs = Date.now() - startTime;

            telemetry.recordMetric(METRIC_REQUEST_DURATION, durationMs, {
              [ATTR_ENDPOINT]: endpoint,
            });
            telemetry.recordMetric(METRIC_ERRORS, 1, {
              [ATTR_ENDPOINT]: endpoint,
              'error.type': err?.constructor?.name || 'Error',
            });

            throw err;
          }
        },
        attributes
      );
    };
  }
}
