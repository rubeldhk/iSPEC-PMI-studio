/**
 * `T728b` — `SteeringSource` bound to `EPIC-019`'s steering. `R-031-1`,
 * `FR-DPE-005`, `FR-DPE-042`.
 *
 * Classification rules are steering documents with `subject:
 * 'risk-classification'`, whose content is `{ "rules": [ … ] }`. This adapter
 * picks the documents that apply to one decision's scope and hands them to
 * `resolveSteering()` — **it does not decide precedence**. `EPIC-019` already
 * does, and a second precedence implementation beside `BR-0071`'s is what
 * `R-031-1` rejected.
 *
 * ## One document wins whole
 *
 * `resolveSteering()` chooses one winner per subject: the narrowest scope. So a
 * project ruleset **replaces** the workspace ruleset rather than merging with it
 * rule by rule. That is `EPIC-019`'s semantics applied faithfully; a project
 * that wants the workspace's rules plus one more restates them. Recorded in
 * `DEF-031-001` alongside the subject addition.
 *
 * ## Unreadable is an error
 *
 * A winning document whose content cannot be read as a ruleset **throws**. The
 * evaluator turns that into a refusal (`FR-DPE-050`): unreadable rules are not
 * permissive rules, and returning an empty ruleset would quietly classify
 * everything by the floor while claiming a document had been read.
 */
import {
  isRiskBand,
  type ClassificationRule,
  type ResolvedRuleset,
  type SteeringSource,
} from '@pmi/decision-contract';
import { resolveSteering, type ResolvableSteeringDocument } from '../steering/steering-resolver.js';
import type { SteeringDocumentRecord } from '../steering/steering.service.js';

export const CLASSIFICATION_SUBJECT = 'risk-classification';

/** The slice of `SteeringService` this adapter reads. */
export interface SteeringLister {
  list(workspaceId: string): Promise<SteeringDocumentRecord[]>;
}

function parseRules(document: SteeringDocumentRecord): ClassificationRule[] {
  const fail = (why: string): never => {
    throw new Error(
      `risk-classification steering document ${document.lineageId} v${document.version} ${why} (FR-DPE-050)`,
    );
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(document.content);
  } catch {
    return fail('is not JSON');
  }
  const rules = (parsed as { rules?: unknown }).rules;
  if (!Array.isArray(rules)) return fail('has no rules list');
  return rules.map((raw, i) => {
    const rule = raw as Record<string, unknown>;
    if (typeof rule['actionPattern'] !== 'string' || rule['actionPattern'] === '') {
      return fail(`rule ${i} names no action pattern`);
    }
    if (!isRiskBand(rule['band'])) return fail(`rule ${i} names a band outside low, medium, high`);
    return {
      actionPattern: rule['actionPattern'],
      band: rule['band'],
      ...(typeof rule['targetType'] === 'string' ? { targetType: rule['targetType'] } : {}),
    };
  });
}

export class SteeringRulesetSource implements SteeringSource {
  constructor(private readonly steering: SteeringLister) {}

  async rulesetFor(scope: { workspaceId: string; projectId: string }): Promise<ResolvedRuleset> {
    const applicable = (await this.steering.list(scope.workspaceId)).filter(
      (d) =>
        (d.subject as string) === CLASSIFICATION_SUBJECT &&
        (d.scope.scopeType === 'organization' ||
          (d.scope.scopeType === 'workspace' && d.scope.scopeRef === scope.workspaceId) ||
          (d.scope.scopeType === 'project' && d.scope.scopeRef === scope.projectId)),
    );
    if (applicable.length === 0) return { rules: [], source: null };

    const resolvable: ResolvableSteeringDocument[] = applicable.map((d) => ({
      id: d.id,
      subject: d.subject,
      scopeType: d.scope.scopeType,
      content: d.content,
      version: d.version,
      status: d.status,
    }));
    const resolution = resolveSteering(resolvable);
    const winner = resolution.resolved[0];
    if (winner === undefined) return { rules: [], source: null };

    const document = applicable.find(
      (d) => d.scope.scopeType === winner.scopeType && d.version === winner.version && d.content === winner.content,
    )!;
    const overrides = resolution.overrides.map(
      (o) =>
        `${o.winning.scopeType} v${o.winning.version} overrides ${o.overridden.scopeType} v${o.overridden.version}`,
    );
    return {
      rules: parseRules(document),
      source: { lineageId: document.lineageId, version: document.version },
      ...(overrides.length > 0
        ? { precedence: `${overrides.join('; ')} — the narrower scope wins (BR-0071)` }
        : {}),
    };
  }
}
