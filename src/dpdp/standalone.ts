/**
 * Standalone DPDP compliance client.
 *
 * Mirrors the Python `DPDPCompliance` class: a self-contained client with its
 * own API key and base URL that combines the server-side DPDP methods with a
 * client-side local scanner, applying a {@link DPDPConfigInput} as defaults for
 * every call.
 *
 * Unlike `client.dpdp` (attached to an existing `RailScore` instance), this
 * class constructs and owns its own client, so it can be used independently:
 *
 * @example
 * ```typescript
 * import { DPDPCompliance } from '@responsible-ai-labs/rail-score';
 *
 * const dpdp = new DPDPCompliance({
 *   apiKey: process.env.RAIL_API_KEY!,
 *   config: { entityType: 'data_fiduciary', purpose: 'loan_advisory', piiAction: 'mask' },
 * });
 *
 * const result = await dpdp.scan('Aadhaar: 2345 6789 0124');
 * const local = dpdp.scanLocal('Call me at +91 9876543210'); // zero-latency
 * ```
 */

import { RailScore } from '../client';
import { DPDPContentScanner } from './scanner';
import { resolveDpdpConfig } from './config';
import type {
  DPDPAuditParams,
  DPDPAuditResult,
  DPDPConfigInput,
  DPDPConfigResolved,
  DPDPContentResult,
  DPDPCreateSessionParams,
  DPDPDecision,
  DPDPEmitParams,
  DPDPEmitResult,
  DPDPEvaluateParams,
  DPDPEvent,
  DPDPEvidenceArtefact,
  DPDPListTimersParams,
  DPDPRequireResult,
  DPDPScanParams,
  DPDPScanResult,
  DPDPSession,
  DPDPTimerList,
} from './types';

/** Options for constructing a {@link DPDPCompliance} client. */
export interface DPDPComplianceOptions {
  /** RAIL Score API key (required). */
  apiKey: string;
  /** DPDP configuration applied as defaults to every call. */
  config?: DPDPConfigInput;
  /** API base URL. Defaults to `https://api.responsibleailabs.ai`. */
  baseUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Enable the 5-minute request cache. */
  cache?: boolean;
  /** Enable exponential-backoff retry on transient errors. */
  retry?: boolean;
}

export class DPDPCompliance {
  private readonly client: RailScore;
  private readonly config: DPDPConfigResolved;
  private readonly scanner: DPDPContentScanner;

  constructor(options: DPDPComplianceOptions) {
    this.config = resolveDpdpConfig(options.config);
    this.client = new RailScore({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      timeout: options.timeout,
      cache: options.cache,
      retry: options.retry,
    });
    this.scanner = new DPDPContentScanner(this.config);
  }

  /** The underlying `RailScore` client this instance owns. */
  get railClient(): RailScore {
    return this.client;
  }

  // ── Server-side API methods ────────────────────────────────────────────────

  /**
   * Server-side content scan. Falls back to the configured `piiAction` and
   * `purpose` when not supplied per call.
   */
  scan(content: string, params: DPDPScanParams = {}): Promise<DPDPScanResult> {
    return this.client.dpdp.scan(content, {
      piiAction: params.piiAction ?? this.config.piiAction,
      childDetection: params.childDetection ?? true,
      purpose: params.purpose ?? (this.config.purpose || undefined),
      sessionId: params.sessionId,
    });
  }

  /** Synchronous allow / block / require_action gate. */
  evaluate(
    action: string,
    context: Record<string, any>,
    params: DPDPEvaluateParams = {}
  ): Promise<DPDPDecision> {
    return this.client.dpdp.evaluate(action, context, params);
  }

  /** Record behavioral events for compliance evidence. */
  emit(events: DPDPEvent | DPDPEvent[], params: DPDPEmitParams = {}): Promise<DPDPEmitResult> {
    return this.client.dpdp.emit(events, params);
  }

  /** Get required actions for the current workflow state. */
  require(
    sessionId: string,
    workflowStep: string,
    context?: Record<string, any>
  ): Promise<DPDPRequireResult> {
    return this.client.dpdp.require(sessionId, workflowStep, context);
  }

  /** Generate audit-grade evidence packets (Pro+ tier). */
  evidence(evidenceType: string, params: Record<string, any>): Promise<DPDPEvidenceArtefact> {
    return this.client.dpdp.evidence(evidenceType, params);
  }

  /**
   * Create a compliance session, merging the configured entity/purpose/sector
   * defaults with any per-call overrides.
   *
   * @throws {ValidationError} when the resolved `purpose` is empty (DPDP S.4).
   */
  createSession(params: Partial<DPDPCreateSessionParams> = {}): Promise<DPDPSession> {
    return this.client.dpdp.createSession({
      entityType: params.entityType ?? this.config.entityType,
      purpose: params.purpose ?? this.config.purpose,
      sector: params.sector ?? this.config.sector,
      processesChildren: params.processesChildren ?? this.config.processesChildren,
      ttlHours: params.ttlHours,
    });
  }

  /** Retrieve an existing compliance session. */
  getSession(sessionId: string): Promise<DPDPSession> {
    return this.client.dpdp.getSession(sessionId);
  }

  /** List active compliance timers. */
  listTimers(params: DPDPListTimersParams = {}): Promise<DPDPTimerList> {
    return this.client.dpdp.listTimers(params);
  }

  /**
   * Run a DPDP system audit, merging the configured entity context with any
   * per-call overrides.
   */
  dpdpAudit(content: string, params: DPDPAuditParams = {}): Promise<DPDPAuditResult> {
    return this.client.dpdp.dpdpAudit(content, {
      entityType: params.entityType ?? this.config.entityType,
      sector: params.sector ?? this.config.sector,
      processesChildren: params.processesChildren ?? this.config.processesChildren,
      crossBorderTransfers: params.crossBorderTransfers ?? this.config.crossBorderTransfers,
      strictMode: params.strictMode,
      includeExplanations: params.includeExplanations,
    });
  }

  // ── Client-side scanning (zero latency, no API call) ─────────────────────────

  /** Client-side regex scan — zero latency, no API call. */
  scanLocal(text: string, sessionFlags: string[] = []): DPDPContentResult {
    return this.scanner.scanText(text, sessionFlags);
  }
}
