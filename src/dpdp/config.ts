/**
 * DPDP configuration defaults and validation.
 */

import { ValidationError } from '../errors';
import {
  VALID_CHILD_ACTIONS,
  VALID_DRIFT_ACTIONS,
  VALID_ENTITY_TYPES,
  VALID_PII_ACTIONS,
  VALID_SECTORS,
} from './constants';
import type { DPDPConfigInput, DPDPConfigResolved } from './types';

const DEFAULTS: DPDPConfigResolved = {
  entityType: 'data_fiduciary',
  sector: 'other',
  purpose: '',
  piiAction: 'mask',
  childContentAction: 'block',
  purposeDriftAction: 'warn',
  processesChildren: false,
  crossBorderTransfers: false,
  indianUsers: 0,
  piiPatterns: ['aadhaar', 'pan', 'mobile_in', 'upi'],
  dsrSlaDays: 90,
  preErasureNoticeHours: 48,
  breachDpbiHours: 72,
  breachCertinHours: 6,
};

/**
 * Merge a partial config with defaults and validate enum fields.
 * Throws {@link ValidationError} on invalid values (mirrors the Python
 * `DPDPConfig.__post_init__` checks).
 */
export function resolveDpdpConfig(config: DPDPConfigInput = {}): DPDPConfigResolved {
  const resolved: DPDPConfigResolved = { ...DEFAULTS, ...config };

  if (!VALID_ENTITY_TYPES.has(resolved.entityType)) {
    throw new ValidationError(
      `entityType must be one of ${[...VALID_ENTITY_TYPES].sort().join(', ')}, got '${resolved.entityType}'`,
      'entityType'
    );
  }
  if (!VALID_SECTORS.has(resolved.sector)) {
    throw new ValidationError(
      `sector must be one of ${[...VALID_SECTORS].sort().join(', ')}, got '${resolved.sector}'`,
      'sector'
    );
  }
  if (!VALID_PII_ACTIONS.has(resolved.piiAction)) {
    throw new ValidationError(
      `piiAction must be one of ${[...VALID_PII_ACTIONS].sort().join(', ')}, got '${resolved.piiAction}'`,
      'piiAction'
    );
  }
  if (!VALID_CHILD_ACTIONS.has(resolved.childContentAction)) {
    throw new ValidationError(
      `childContentAction must be one of ${[...VALID_CHILD_ACTIONS].sort().join(', ')}, got '${resolved.childContentAction}'`,
      'childContentAction'
    );
  }
  if (!VALID_DRIFT_ACTIONS.has(resolved.purposeDriftAction)) {
    throw new ValidationError(
      `purposeDriftAction must be one of ${[...VALID_DRIFT_ACTIONS].sort().join(', ')}, got '${resolved.purposeDriftAction}'`,
      'purposeDriftAction'
    );
  }

  return resolved;
}
