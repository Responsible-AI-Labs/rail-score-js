import type { RAILTelemetry } from './core';
import type { ComplianceResult, MultiComplianceResult } from '../types';
import {
  ATTR_COMPLIANCE_FRAMEWORK,
  ATTR_COMPLIANCE_SCORE,
  ATTR_COMPLIANCE_LABEL,
  ATTR_COMPLIANCE_REQS_PASSED,
  ATTR_COMPLIANCE_REQS_FAILED,
  ATTR_INCIDENT_ID,
  ATTR_INCIDENT_TYPE,
  ATTR_INCIDENT_SEVERITY,
  ATTR_INCIDENT_STATUS,
  ATTR_INCIDENT_TITLE,
  ATTR_INCIDENT_THRESHOLD,
  ATTR_INCIDENT_AFFECTED_DIMS,
} from './constants';

/**
 * Logs compliance evaluation results with structured output and optional OTEL spans.
 *
 * @example
 * ```typescript
 * const logger = new ComplianceLogger(telemetry);
 * logger.logComplianceResult(result, 'AI system processes personal data...');
 * ```
 */
export class ComplianceLogger {
  private telemetry: RAILTelemetry | undefined;
  private logger: Console;

  constructor(telemetry?: RAILTelemetry, logger?: Console) {
    this.telemetry = telemetry;
    this.logger = logger || console;
  }

  /**
   * Logs a single-framework compliance result.
   *
   * @param result          Single-framework compliance result
   * @param contentPreview  Optional preview of evaluated content (for logging context)
   */
  logComplianceResult(result: ComplianceResult, contentPreview?: string): void {
    const { framework, compliance_score, requirements_passed, requirements_failed } = result;
    const score = compliance_score.score;
    const label = compliance_score.label;

    const preview = contentPreview
      ? ` | content: "${contentPreview.slice(0, 80)}${contentPreview.length > 80 ? '…' : ''}"`
      : '';

    this.logger.info(
      `[RAIL Compliance] ${framework} | score=${score.toFixed(2)} | label=${label}` +
      ` | passed=${requirements_passed} | failed=${requirements_failed}${preview}`
    );

    // Warn on medium severity issues
    const mediumOrLow = result.issues.filter(
      (i) => i.severity === 'medium' || i.severity === 'low'
    );
    for (const issue of mediumOrLow) {
      this.logger.warn(
        `[RAIL Compliance] [${framework}] ${issue.severity.toUpperCase()} — ${issue.description}` +
        ` (${issue.article})`
      );
    }

    // Error on high severity issues
    const highSeverity = result.issues.filter((i) => i.severity === 'high');
    for (const issue of highSeverity) {
      this.logger.error(
        `[RAIL Compliance] [${framework}] HIGH — ${issue.description}` +
        ` (${issue.article}) — remediation: ${issue.remediation_effort}`
      );
    }

    // Record OTEL span if telemetry is configured
    if (this.telemetry?.isAvailable) {
      const attributes: Record<string, string | number | boolean> = {
        [ATTR_COMPLIANCE_FRAMEWORK]: framework,
        [ATTR_COMPLIANCE_SCORE]: score,
        [ATTR_COMPLIANCE_LABEL]: label,
        [ATTR_COMPLIANCE_REQS_PASSED]: requirements_passed,
        [ATTR_COMPLIANCE_REQS_FAILED]: requirements_failed,
      };

      // Fire-and-forget span for logging — we don't await since this is synchronous context
      this.telemetry
        .startSpan('rail.compliance.log', async (span) => {
          if (span) span.setAttributes(attributes);
          return undefined;
        })
        .catch(() => {
          // Non-fatal — telemetry errors should never propagate
        });
    }
  }

  /**
   * Logs a multi-framework compliance result by iterating each framework result
   * and then emitting a cross-framework summary.
   *
   * @param result  Multi-framework compliance result
   */
  logMultiComplianceResult(result: MultiComplianceResult): void {
    for (const [, frameworkResult] of Object.entries(result.results)) {
      this.logComplianceResult(frameworkResult);
    }

    const { cross_framework_summary } = result;
    this.logger.info(
      `[RAIL Compliance] Cross-framework summary:` +
      ` frameworks=${cross_framework_summary.frameworks_evaluated}` +
      ` | avg_score=${cross_framework_summary.average_score.toFixed(2)}` +
      ` | weakest=${cross_framework_summary.weakest_framework}` +
      ` (${cross_framework_summary.weakest_score.toFixed(2)})`
    );
  }
}

export interface IncidentOptions {
  id: string;
  type: string;
  severity: string;
  title: string;
  affectedDimensions: string[];
  threshold: number;
  metadata?: Record<string, any>;
}

/**
 * Creates and logs structured incident records with optional OTEL spans.
 *
 * @example
 * ```typescript
 * const incidentLogger = new IncidentLogger(telemetry);
 * incidentLogger.createIncident({
 *   id: 'inc-001',
 *   type: 'safety_violation',
 *   severity: 'high',
 *   title: 'Safety score below threshold',
 *   affectedDimensions: ['safety', 'user_impact'],
 *   threshold: 7.0,
 * });
 * ```
 */
export class IncidentLogger {
  private telemetry: RAILTelemetry | undefined;
  private logger: Console;

  constructor(telemetry?: RAILTelemetry, logger?: Console) {
    this.telemetry = telemetry;
    this.logger = logger || console;
  }

  /**
   * Logs a structured incident and optionally records it as an OTEL span.
   */
  createIncident(options: IncidentOptions): void {
    const {
      id,
      type,
      severity,
      title,
      affectedDimensions,
      threshold,
      metadata = {},
    } = options;

    const incident = {
      incident_id: id,
      type,
      severity,
      status: 'open',
      title,
      affected_dimensions: affectedDimensions,
      threshold,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    this.logger.error(`[RAIL Incident] ${JSON.stringify(incident)}`);

    if (this.telemetry?.isAvailable) {
      const attributes: Record<string, string | number | boolean> = {
        [ATTR_INCIDENT_ID]: id,
        [ATTR_INCIDENT_TYPE]: type,
        [ATTR_INCIDENT_SEVERITY]: severity,
        [ATTR_INCIDENT_STATUS]: 'open',
        [ATTR_INCIDENT_TITLE]: title,
        [ATTR_INCIDENT_THRESHOLD]: threshold,
        [ATTR_INCIDENT_AFFECTED_DIMS]: affectedDimensions.join(','),
      };

      this.telemetry
        .startSpan('rail.incident', async (span) => {
          if (span) span.setAttributes(attributes);
          return undefined;
        })
        .catch(() => {
          // Non-fatal
        });
    }
  }
}
