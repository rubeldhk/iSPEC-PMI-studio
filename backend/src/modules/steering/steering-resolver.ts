/**
 * T240 — steering resolution (FR-ENH-005). A PURE function.
 *
 * Narrower scope wins per subject; the displaced broader rule is recorded as
 * an override naming both winner and loser — never discarded. The resolved
 * set leaves ordered broadest to narrowest (contract rule S3), pre-resolved
 * (S2): the adapter never settles precedence.
 */
import { SCOPE_ORDER, type SteeringScopeType } from './scope-resolver.js';
import type { SteeringSubject } from './steering.validation.js';

export interface ResolvableSteeringDocument {
  id: string;
  subject: SteeringSubject;
  scopeType: SteeringScopeType;
  content: string;
  version: number;
  status: 'active' | 'retired';
}

/** The contract shape (steering-contract.md) — plain data, nothing to dereference. */
export interface ResolvedSteering {
  subject: SteeringSubject;
  scopeType: SteeringScopeType;
  content: string;
  version: number;
}

export interface SteeringOverrideParty {
  id: string;
  subject: SteeringSubject;
  scopeType: SteeringScopeType;
  version: number;
}

export interface SteeringOverride {
  winning: SteeringOverrideParty;
  overridden: SteeringOverrideParty;
}

export interface SteeringResolution {
  resolved: ResolvedSteering[];
  overrides: SteeringOverride[];
}

function depth(scopeType: SteeringScopeType): number {
  return SCOPE_ORDER.indexOf(scopeType);
}

function party(document: ResolvableSteeringDocument): SteeringOverrideParty {
  return {
    id: document.id,
    subject: document.subject,
    scopeType: document.scopeType,
    version: document.version,
  };
}

export function resolveSteering(documents: ResolvableSteeringDocument[]): SteeringResolution {
  const active = documents.filter((d) => d.status === 'active');

  // Per subject: the narrowest active document wins; every displaced broader
  // one becomes an override record.
  const winners = new Map<SteeringSubject, ResolvableSteeringDocument>();
  const overrides: SteeringOverride[] = [];
  for (const document of active) {
    const current = winners.get(document.subject);
    if (!current) {
      winners.set(document.subject, document);
    } else if (depth(document.scopeType) > depth(current.scopeType)) {
      overrides.push({ winning: party(document), overridden: party(current) });
      winners.set(document.subject, document);
    } else {
      overrides.push({ winning: party(current), overridden: party(document) });
    }
  }

  const resolved = [...winners.values()]
    .sort((a, b) => depth(a.scopeType) - depth(b.scopeType))
    .map(({ subject, scopeType, content, version }) => ({ subject, scopeType, content, version }));

  return { resolved, overrides };
}
