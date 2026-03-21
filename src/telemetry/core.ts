import {
  RESOURCE_ORG_ID,
  RESOURCE_PROJECT_ID,
  RESOURCE_ENVIRONMENT,
  RESOURCE_SDK_VERSION,
} from './constants';

export interface TelemetryConfig {
  serviceName?: string;
  orgId?: string;
  projectId?: string;
  environment?: string;
  sdkVersion?: string;
  /** 'console' logs to stdout, 'otlp' sends to collector, 'none' disables */
  exporter?: 'console' | 'otlp' | 'none';
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  protocol?: 'grpc' | 'http/protobuf' | 'http/json';
}

/**
 * RAILTelemetry provides optional OpenTelemetry integration for the RAIL SDK.
 *
 * OTEL packages are optional peer dependencies — if not installed, all methods
 * degrade gracefully to no-ops without throwing errors.
 *
 * @example
 * ```typescript
 * const telemetry = new RAILTelemetry({
 *   serviceName: 'my-service',
 *   orgId: 'org-123',
 *   exporter: 'otlp',
 *   otlpEndpoint: 'http://localhost:4317',
 * });
 * ```
 */
export class RAILTelemetry {
  private config: TelemetryConfig;
  private otelAvailable = false;
  private api: any = null;
  private tracer: any = null;
  private meter: any = null;

  constructor(config: TelemetryConfig = {}) {
    this.config = config;
    this.initOtel();
  }

  private initOtel(): void {
    if (this.config.exporter === 'none') {
      return;
    }

    try {
      // Lazily require @opentelemetry/api — optional peer dep
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.api = require('@opentelemetry/api');
      this.otelAvailable = true;

      const serviceName = this.config.serviceName || 'rail-score-sdk';

      // Attempt to set up SDK if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { NodeSDK } = require('@opentelemetry/sdk-node');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { resourceFromAttributes } = require('@opentelemetry/resources');

        const resourceAttrs: Record<string, string> = {
          'service.name': serviceName,
        };

        if (this.config.orgId) {
          resourceAttrs[RESOURCE_ORG_ID] = this.config.orgId;
        }
        if (this.config.projectId) {
          resourceAttrs[RESOURCE_PROJECT_ID] = this.config.projectId;
        }
        if (this.config.environment) {
          resourceAttrs[RESOURCE_ENVIRONMENT] = this.config.environment;
        }
        if (this.config.sdkVersion) {
          resourceAttrs[RESOURCE_SDK_VERSION] = this.config.sdkVersion;
        }

        const resource = resourceFromAttributes(resourceAttrs);

        let traceExporter: any;
        if (this.config.exporter === 'console') {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
            traceExporter = new ConsoleSpanExporter();
          } catch {
            // ConsoleSpanExporter not available
          }
        } else if (this.config.exporter === 'otlp') {
          const proto = this.config.protocol || 'grpc';
          try {
            if (proto === 'grpc') {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
              traceExporter = new OTLPTraceExporter({
                url: this.config.otlpEndpoint,
                headers: this.config.otlpHeaders,
              });
            } else {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
              traceExporter = new OTLPTraceExporter({
                url: this.config.otlpEndpoint,
                headers: this.config.otlpHeaders,
              });
            }
          } catch {
            // Exporter package not available
          }
        }

        const sdkConfig: Record<string, any> = { resource };
        if (traceExporter) {
          sdkConfig.traceExporter = traceExporter;
        }

        const sdk = new NodeSDK(sdkConfig);
        sdk.start();
      } catch {
        // SDK packages not available — tracer/meter will still work via global API
      }

      this.tracer = this.api.trace.getTracer(serviceName);
      this.meter = this.api.metrics.getMeter(serviceName);
    } catch {
      // @opentelemetry/api not installed — silently disable
      this.otelAvailable = false;
    }
  }

  /** Whether OpenTelemetry packages are available */
  get isAvailable(): boolean {
    return this.otelAvailable;
  }

  /** Returns the OTEL tracer or null if OTEL is unavailable */
  getTracer(): any | null {
    return this.tracer;
  }

  /** Returns the OTEL meter or null if OTEL is unavailable */
  getMeter(): any | null {
    return this.meter;
  }

  /**
   * Wraps a function in an OTEL span. If OTEL is unavailable, calls fn directly.
   *
   * @param name  Span name
   * @param fn    Function to wrap
   * @param attributes  Optional span attributes to set
   */
  async startSpan<T>(
    name: string,
    fn: (span: any) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    if (!this.otelAvailable || !this.tracer) {
      return fn(null);
    }

    return this.tracer.startActiveSpan(name, async (span: any) => {
      try {
        if (attributes) {
          span.setAttributes(attributes);
        }
        const result = await fn(span);
        span.setStatus({ code: this.api.SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.setStatus({
          code: this.api.SpanStatusCode.ERROR,
          message: err?.message || String(err),
        });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Records a metric value. Uses Counter for integer values and Histogram otherwise.
   *
   * @param name        Metric name (use constants from TelemetryConstants)
   * @param value       Numeric value
   * @param attributes  Optional metric attributes
   */
  recordMetric(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean>
  ): void {
    if (!this.otelAvailable || !this.meter) {
      return;
    }

    try {
      // Use counter for request/error counts, histogram for durations and distributions
      if (
        name.endsWith('.requests') ||
        name.endsWith('.errors') ||
        name.endsWith('.consumed')
      ) {
        const counter = this.meter.createCounter(name);
        counter.add(value, attributes);
      } else {
        const histogram = this.meter.createHistogram(name);
        histogram.record(value, attributes);
      }
    } catch {
      // Metric recording failures are non-fatal
    }
  }
}
