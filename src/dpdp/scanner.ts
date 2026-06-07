/**
 * Client-side DPDP content scanner — zero-latency PII and child signal detection.
 *
 * Runs entirely locally with no network calls. For richer server-side analysis
 * (full-corpus Verhoeff checks, bank-handle validation, semantic purpose drift),
 * use `client.dpdp.scan()`.
 */

import { resolveDpdpConfig } from './config';
import {
  CHILD_AGE_PATTERNS,
  CHILD_AGE_THRESHOLD,
  CHILD_CONTEXT_PATTERNS,
  CHILD_MINOR_KEYWORDS,
  CHILD_PARENTAL_PATTERNS,
  CHILD_SCHOOL_PATTERNS,
  PII_MASKERS,
  PII_PATTERNS,
  SECTION_REFS,
  verhoeffValidate,
} from './constants';
import type {
  DPDPChildSignal,
  DPDPConfigInput,
  DPDPConfigResolved,
  DPDPContentResult,
  DPDPPiiMatch,
  DPDPViolation,
} from './types';

const TARGETING_PATTERNS: string[] = [
  '\\bbased\\s+on\\s+(?:his|her|their|your)\\s+(?:browsing|behavior|activity|profile|purchase)',
  '\\brecommend(?:ed|ation|s)?\\b.*\\b(?:product|supplement|purchase|buy)\\b',
  '\\btargeted\\s+(?:ad|advertisement|content|offer)',
  '\\bsimilar\\s+users?\\s+(?:also\\s+)?(?:bought|purchased|liked)',
  '\\bpersonali[sz]ed\\s+(?:offer|deal|recommendation)',
  '\\bbehavioral\\s+(?:tracking|monitoring|profiling|analysis)',
];

const DRIFT_INDICATORS: Record<string, string[]> = {
  advertising: ['advertis', 'promo', 'sponsored', 'retarget', 'campaign'],
  tracking: ['track', 'monitor', 'surveillance', 'fingerprint'],
  profiling: ['profil', 'behavioral analysis', 'predict'],
  selling_data: ['sell data', 'share with third part', 'data broker'],
};

/**
 * Client-side regex scanner for Indian PII and child signals.
 */
export class DPDPContentScanner {
  private readonly config: DPDPConfigResolved;
  private readonly activePatterns: Record<string, RegExp>;

  constructor(config: DPDPConfigInput | DPDPConfigResolved = {}) {
    this.config = resolveDpdpConfig(config as DPDPConfigInput);
    this.activePatterns = {};
    for (const [k, v] of Object.entries(PII_PATTERNS)) {
      if (this.config.piiPatterns.includes(k)) {
        this.activePatterns[k] = v;
      }
    }
  }

  /**
   * Run all DPDP pattern checks on `text`.
   *
   * @param text - The text to scan.
   * @param sessionFlags - Existing session flags (e.g. `["child_data_detected"]`).
   */
  scanText(text: string, sessionFlags: string[] = []): DPDPContentResult {
    let flags = [...sessionFlags];
    const piiFound = this.detectPii(text);
    const childSignals = this.detectChildSignals(text);
    const violations: DPDPViolation[] = [];

    if (childSignals.length > 0) {
      flags = Array.from(new Set([...flags, 'child_data_detected']));
    }

    const childTargeting = this.checkChildTargeting(text, flags);
    if (childTargeting) {
      violations.push(childTargeting);
    }

    const purposeViolation = this.checkPurposeDrift(text);
    if (purposeViolation) {
      violations.push(purposeViolation);
    }

    if (piiFound.length > 0) {
      const types = Array.from(new Set(piiFound.map((p) => p.type))).sort();
      violations.push({
        check: 'pii_leak',
        section: SECTION_REFS['pii_leak'],
        reason: `Indian PII detected: ${types.join(', ')}`,
        action: this.config.piiAction,
        found: piiFound.map((p) => p.type).join(', '),
        severity: 'critical',
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
      piiFound,
      childSignals,
      sessionFlags: flags,
      maskedContent: null,
      originalContent: text,
    };
  }

  /**
   * Apply configured actions (mask/block) and return the processed text.
   *
   * @returns A tuple `[processedText, updatedResult]`.
   */
  applyActions(result: DPDPContentResult, text: string): [string, DPDPContentResult] {
    let processed = text;

    if (result.piiFound.length > 0 && this.config.piiAction === 'mask') {
      processed = this.maskPii(processed, result.piiFound);
      result.maskedContent = processed;
    }

    if (result.piiFound.length > 0 && this.config.piiAction === 'block') {
      processed = '[Content blocked: Indian PII detected in output]';
      result.maskedContent = processed;
    }

    if (result.sessionFlags.includes('child_data_detected')) {
      for (const v of result.violations) {
        if (v.check === 'child_targeting' && this.config.childContentAction === 'block') {
          processed =
            '[Content blocked: behavioral targeting not permitted for users under 18]';
          result.maskedContent = processed;
          break;
        }
      }
    }

    return [processed, result];
  }

  // ── PII detection ──────────────────────────────────────────────────────────

  private detectPii(text: string): DPDPPiiMatch[] {
    const matches: DPDPPiiMatch[] = [];
    for (const [piiType, pattern] of Object.entries(this.activePatterns)) {
      // Clone with the global flag so matchAll works and lastIndex never leaks.
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      for (const m of text.matchAll(re)) {
        const raw = m[0];

        if (piiType === 'aadhaar') {
          const digits = raw.replace(/\s/g, '');
          if (!verhoeffValidate(digits)) {
            continue;
          }
        }

        const masker = PII_MASKERS[piiType];
        const masked = masker ? masker(raw) : `[${piiType.toUpperCase()}]`;
        const start = m.index ?? 0;

        matches.push({
          type: piiType,
          value: raw,
          start,
          end: start + raw.length,
          maskedValue: masked,
          severity: 'high',
          section: 'S.8(5)',
          penaltyCrore: 250,
        });
      }
    }
    return matches;
  }

  private maskPii(text: string, piiMatches: DPDPPiiMatch[]): string {
    const sorted = [...piiMatches].sort((a, b) => b.start - a.start);
    let result = text;
    for (const pm of sorted) {
      result = result.slice(0, pm.start) + pm.maskedValue + result.slice(pm.end);
    }
    return result;
  }

  // ── Child signal detection ───────────────────────────────────────────────────

  private detectChildSignals(text: string): DPDPChildSignal[] {
    const signals: DPDPChildSignal[] = [];

    const ageGroups = [...CHILD_AGE_PATTERNS, ...CHILD_CONTEXT_PATTERNS];
    for (const pattern of ageGroups) {
      for (const m of text.matchAll(pattern)) {
        const age = parseInt(m[1], 10);
        if (!isNaN(age) && age < CHILD_AGE_THRESHOLD) {
          signals.push({
            signalType: 'age_mention',
            evidence: m[0].trim(),
            detectedAge: age,
            section: 'S.9',
          });
        }
      }
    }

    for (const pattern of CHILD_SCHOOL_PATTERNS) {
      for (const m of text.matchAll(pattern)) {
        const gradeStr = m[1];
        let inferredAge: number | null = null;
        const gradeNum = gradeStr !== undefined ? parseInt(gradeStr, 10) : NaN;
        if (!isNaN(gradeNum)) {
          inferredAge = gradeNum + 5;
          if (inferredAge >= CHILD_AGE_THRESHOLD) {
            continue;
          }
        }
        signals.push({
          signalType: 'grade_mention',
          evidence: m[0].trim(),
          detectedAge: inferredAge,
          section: 'S.9',
        });
      }
    }

    const minorMatch = CHILD_MINOR_KEYWORDS.exec(text);
    if (minorMatch) {
      signals.push({
        signalType: 'minor_keyword',
        evidence: minorMatch[0].trim(),
        detectedAge: null,
        section: 'S.9',
      });
    }

    const parentalMatch = CHILD_PARENTAL_PATTERNS.exec(text);
    if (parentalMatch) {
      signals.push({
        signalType: 'parental_reference',
        evidence: parentalMatch[0].trim(),
        detectedAge: null,
        section: 'S.9',
      });
    }

    return signals;
  }

  // ── Child targeting check ─────────────────────────────────────────────────────

  private checkChildTargeting(text: string, sessionFlags: string[]): DPDPViolation | null {
    if (!sessionFlags.includes('child_data_detected')) {
      return null;
    }

    for (const patStr of TARGETING_PATTERNS) {
      if (new RegExp(patStr, 'i').test(text)) {
        return {
          check: 'child_targeting',
          section: SECTION_REFS['child_targeting'],
          reason: 'Behavioral recommendation for minor-flagged session',
          action: this.config.childContentAction,
          found: null,
          severity: 'critical',
        };
      }
    }
    return null;
  }

  // ── Purpose drift check ───────────────────────────────────────────────────────

  private checkPurposeDrift(text: string): DPDPViolation | null {
    if (!this.config.purpose) {
      return null;
    }

    const purposeLower = this.config.purpose.toLowerCase();
    const textLower = text.toLowerCase();

    for (const [driftType, keywords] of Object.entries(DRIFT_INDICATORS)) {
      if (purposeLower.includes(driftType)) {
        continue;
      }
      for (const kw of keywords) {
        if (textLower.includes(kw)) {
          return {
            check: 'purpose_drift',
            section: SECTION_REFS['purpose_drift'],
            reason: `Output contains '${kw}' which may drift from declared purpose '${this.config.purpose}'`,
            action: this.config.purposeDriftAction,
            found: null,
            severity: 'medium',
          };
        }
      }
    }
    return null;
  }
}
