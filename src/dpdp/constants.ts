/**
 * DPDP compliance constants: Indian PII patterns, child signals, section references.
 *
 * Ported from the Python SDK's `compliance/dpdp/constants.py`. Patterns are
 * declared with the `g` flag so they can be used with `String.prototype.matchAll`.
 */

// ─── Indian PII regex patterns ───────────────────────────────────────────────

export const AADHAAR_PATTERN = /\b([2-9]\d{3})\s?(\d{4})\s?(\d{4})\b/g;

export const PAN_PATTERN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

export const MOBILE_IN_PATTERN = /\b(?:\+91[\s\-]?|0)?[6-9]\d{9}\b/g;

export const UPI_PATTERN =
  /\b[\w.\-]+@(?:ybl|paytm|oksbi|okaxis|okicici|okhdfcbank|upi|apl|ibl|axl|sbi|icici|hdfcbank|kotak|indus|rbl|federal|idbi|citi|barodampay|unionbankofindia|cnrb|pnb|bob|mahabank|dbs|jupiteraxis|freecharge|phonepe|gpay|slice|niyox)\b/gi;

export const VOTER_ID_PATTERN = /\b[A-Z]{3}\d{7}\b/g;

export const PASSPORT_PATTERN = /\b[JKLMRSTUVZ]\d{7}\b/g;

export const DRIVING_LICENSE_PATTERN = /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}\b/g;

export const IFSC_PATTERN = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;

export const BANK_ACCOUNT_CONTEXT_PATTERN =
  /(?:account|a\/c|acct|bank\s*a\/c)[\s#:.\-]*(\d{9,18})\b/gi;

export const GSTIN_PATTERN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9]\b/g;

export const PII_PATTERNS: Record<string, RegExp> = {
  aadhaar: AADHAAR_PATTERN,
  pan: PAN_PATTERN,
  mobile_in: MOBILE_IN_PATTERN,
  upi: UPI_PATTERN,
  voter_id: VOTER_ID_PATTERN,
  passport: PASSPORT_PATTERN,
  driving_license: DRIVING_LICENSE_PATTERN,
  ifsc: IFSC_PATTERN,
  bank_account: BANK_ACCOUNT_CONTEXT_PATTERN,
  gstin: GSTIN_PATTERN,
};

// ─── Verhoeff checksum (Aadhaar validation) ──────────────────────────────────

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validate a number string using the Verhoeff checksum algorithm.
 * Used to weed out false-positive Aadhaar matches.
 */
export function verhoeffValidate(numberStr: string): boolean {
  const digits = numberStr
    .split('')
    .filter((ch) => ch >= '0' && ch <= '9')
    .map((ch) => parseInt(ch, 10));
  let c = 0;
  const reversed = digits.slice().reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return c === 0;
}

// ─── PII masking ─────────────────────────────────────────────────────────────

function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\s/g, '');
  return `XXXX XXXX ${digits.slice(-4)}`;
}

function maskPan(val: string): string {
  return `XXXXX${val.slice(5)}`;
}

function maskUpi(val: string): string {
  const handle = val.split('@').pop();
  return `XXXX@${handle}`;
}

function maskGeneric(label: string): (val: string) => string {
  return () => `[${label}]`;
}

/** Returns the masked replacement for a matched PII value. */
export const PII_MASKERS: Record<string, (val: string) => string> = {
  aadhaar: maskAadhaar,
  pan: maskPan,
  mobile_in: () => '[MOBILE]',
  upi: maskUpi,
  voter_id: maskGeneric('VOTER_ID'),
  passport: maskGeneric('PASSPORT'),
  driving_license: maskGeneric('DL'),
  ifsc: maskGeneric('IFSC'),
  bank_account: maskGeneric('BANK_ACCOUNT'),
  gstin: maskGeneric('GSTIN'),
};

// ─── Child signal patterns ───────────────────────────────────────────────────

export const CHILD_AGE_PATTERNS: RegExp[] = [
  /\b(?:I\s+am|I'm|my\s+age\s+is|aged?)\s+(?:under\s+)?(\d{1,2})\b/gi,
  /\b(\d{1,2})\s*(?:year|yr)s?\s*old\b/gi,
];

export const CHILD_CONTEXT_PATTERNS: RegExp[] = [
  /\bmy\s+(?:son|daughter|child|kid|boy|girl)\s+(?:is\s+)?(?:aged?\s+)?(\d{1,2})\b/gi,
  /\bmy\s+(?:son|daughter|child|kid|boy|girl)\b.*?\b(\d{1,2})\s*(?:year|yr)s?\s*old\b/gi,
];

export const CHILD_SCHOOL_PATTERNS: RegExp[] = [
  /\b(?:class|grade|standard)\s*(\d{1,2}|[IVX]+)\b/gi,
  /\b(?:\d{1,2}th|[IVX]+th)\s+(?:class|grade|standard)\b/gi,
];

export const CHILD_MINOR_KEYWORDS =
  /\b(?:I\s+am\s+a\s+minor|i\s+am\s+underage|i'm\s+a\s+minor)\b/i;

export const CHILD_PARENTAL_PATTERNS =
  /\b(?:my\s+(?:parents?|mom|dad|mother|father|guardian)\s+(?:said|told|asked|wants?))\b/i;

/** Age threshold for DPDP Act Section 9 (children under 18). */
export const CHILD_AGE_THRESHOLD = 18;

// ─── DPDP Act section references ──────────────────────────────────────────────

export const SECTION_REFS: Record<string, string> = {
  pii_leak: 'S.8(5)',
  child_data: 'S.9',
  child_targeting: 'S.9(3)',
  child_tracking: 'S.9(3)(b)',
  child_advertising: 'S.9(3)(c)',
  consent_missing: 'S.6',
  notice_missing: 'S.5',
  purpose_drift: 'S.6',
  purpose_limitation: 'S.4',
  data_minimisation: 'S.4',
  security_safeguards: 'S.8(5)',
  breach_notification: 'S.8(6)',
  retention_erasure: 'S.8(7)',
  rights_grievance: 'S.11-14',
  processor_governance: 'S.8(1)-(2)',
  cross_border: 'S.16',
  accuracy_decisions: 'S.8(3)',
};

// ─── Valid configuration values ───────────────────────────────────────────────

export const VALID_ENTITY_TYPES = new Set([
  'data_fiduciary',
  'significant_data_fiduciary',
]);

export const VALID_SECTORS = new Set([
  'fintech',
  'finance',
  'banking',
  'healthcare',
  'edtech',
  'e_commerce',
  'social_media',
  'other',
]);

export const VALID_PII_ACTIONS = new Set(['detect', 'mask', 'block', 'warn', 'log']);
export const VALID_CHILD_ACTIONS = new Set(['block', 'warn', 'log']);
export const VALID_DRIFT_ACTIONS = new Set(['block', 'warn', 'log']);

export const VALID_EVALUATE_ACTIONS = new Set([
  'process_data',
  'make_decision',
  'share_data',
  'transfer_cross_border',
  'serve_ad',
  'track_user',
]);

export const VALID_WORKFLOW_STEPS = new Set([
  'data_collection',
  'data_processing',
  'decision_making',
  'decision_communication',
  'data_retention',
  'dsr_handling',
]);

export const VALID_EVIDENCE_TYPES = new Set([
  'dsr_response',
  'breach_notification_dpbi',
  'breach_notification_principal',
  'breach_notification_certin',
  'compliance_health',
  'consent_audit',
  'child_protection_audit',
  'sdf_annual_report',
]);

// ─── Event type taxonomy ──────────────────────────────────────────────────────

export const CONSENT_EVENTS = new Set([
  'notice.shown',
  'consent.granted',
  'consent.refused',
  'consent.withdrawn',
]);

export const DECISION_EVENTS = new Set([
  'decision.made',
  'explanation.shown',
  'appeal.opened',
  'appeal.resolved',
]);

export const DSR_EVENTS = new Set([
  'dsr.received',
  'dsr.acknowledged',
  'dsr.responded',
  'dsr.escalated',
]);

export const DATA_LIFECYCLE_EVENTS = new Set([
  'data.collected',
  'data.shared',
  'data.transferred',
  'retention.started',
  'erasure.executed',
  'breach.detected',
]);

export const CHILD_EVENTS = new Set([
  'child.detected',
  'child.parental_consent',
  'child.tracking_attempted',
  'child.aged_out',
]);

export const MODEL_EVENTS = new Set(['model.deployed', 'model.retrained']);

export const AGGREGATE_EVENTS = new Set([
  'aggregate.fairness_metrics',
  'aggregate.decision_stats',
]);

export const ALL_EVENT_TYPES = new Set<string>([
  ...CONSENT_EVENTS,
  ...DECISION_EVENTS,
  ...DSR_EVENTS,
  ...DATA_LIFECYCLE_EVENTS,
  ...CHILD_EVENTS,
  ...MODEL_EVENTS,
  ...AGGREGATE_EVENTS,
]);
