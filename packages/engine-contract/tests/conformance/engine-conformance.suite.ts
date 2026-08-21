/**
 * T038 — the shared engine conformance suite.
 *
 * ONE suite, run against EVERY adapter including the fixture. An adapter is not
 * conformant until all thirteen cases pass
 * (specs/_shared/contracts/specification-engine.md § Contract test suite).
 *
 * This is what makes "Spec Kit is Engine V1, not the product" checkable rather
 * than aspirational: a second engine either passes these or it is not an engine.
 *
 * The suite is deliberately NOT a `.spec.ts` file — it exports a function that
 * an adapter's own spec calls, so each adapter reports its own results.
 */
import { describe, it, expect } from 'vitest';
import {
  MissingCapabilityError,
  PHASE_1_CAPABILITIES,
  assertPhase1Capabilities,
  isSteeringOrdered,
  type EngineCapability,
  type EngineContext,
  type EngineDescriptor,
  type EngineFailureReason,
  type RequirementInput,
  type SpecificationEngine,
  type SteeringInput,
} from '../../src/index';

/**
 * What an adapter must supply to be measured.
 *
 * Every method is required. An adapter that cannot be driven into a failure
 * mode has a gap in its test seams, and the suite should say so rather than
 * skip the case quietly — a skipped conformance case reads as a pass in every
 * summary that matters.
 */
export interface ConformanceHarness {
  /** Adapter name, used in test titles. */
  readonly name: string;
  /** A healthy engine. */
  create(): SpecificationEngine;
  /** An engine that will terminate with exactly this reason. */
  createFailing(reason: EngineFailureReason): SpecificationEngine;
  /** An engine whose work lasts at least `delayMs`, so it can be cancelled or timed out. */
  createSlow(delayMs: number): SpecificationEngine;
  /** A descriptor missing the named capability — for the registration-refusal case. */
  incompleteDescriptor(missing: EngineCapability): EngineDescriptor;
  /** Largest selection the adapter accepts. */
  readonly inputCeiling: number;
  /** E8 — assert no process, container, or temporary file survived. */
  assertNothingLeftBehind(): Promise<void>;
  /**
   * E9 — a credential-shaped value the engine can see. The suite asserts it
   * never surfaces in a message, diagnostics, or output.
   */
  readonly secretProbe: string;
  /**
   * C16 (EPIC-019 T245) — an engine that, given steering, reports a violation
   * of it. The suite asserts the violation arrives as a FINDING on a
   * successful result, never as a failure (steering-contract rule S6).
   */
  createSteeringViolating(): SpecificationEngine;
}

const REQUIREMENT: RequirementInput = {
  reference: 'FR-001',
  description: 'The system records who approved each specification',
  type: 'functional',
  priority: 'p1',
};

function context(overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    // A real correlation id. The platform issues UUIDs, and at least one
    // adapter refuses to start a sandbox without one (PC-3) — so a placeholder
    // string here would test a shape the platform never actually produces.
    correlationId: '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607',
    ...overrides,
  };
}

function selectionOf(count: number): RequirementInput[] {
  return Array.from({ length: count }, (_, i) => ({ ...REQUIREMENT, reference: `FR-${i + 1}` }));
}

/** Credential shapes that must never appear in anything an operator or user sees. */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{8,}/,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bAI_PROVIDER_TOKEN\s*=\s*\S+/i,
  /\bDATABASE_URL\s*=\s*\S+/i,
  /\bpassword\s*[=:]\s*\S+/i,
];

export function runEngineConformance(harness: ConformanceHarness): void {
  describe(`engine conformance · ${harness.name}`, () => {
    // ---------------------------------------------------------------- 1
    it('C01 · declares all three Phase 1 capabilities (E1)', () => {
      const { capabilities } = harness.create().descriptor;
      for (const capability of PHASE_1_CAPABILITIES) {
        expect(capabilities, `missing capability ${capability}`).toContain(capability);
      }
    });

    // ---------------------------------------------------------------- 2
    it.each([...PHASE_1_CAPABILITIES])(
      'C02 · registration is refused when %s is missing, naming it (FR-021)',
      (missing) => {
        const descriptor = harness.incompleteDescriptor(missing);
        try {
          assertPhase1Capabilities(descriptor);
          throw new Error('expected registration to be refused');
        } catch (error) {
          expect(error).toBeInstanceOf(MissingCapabilityError);
          expect((error as MissingCapabilityError).missing).toContain(missing);
          expect((error as Error).message).toContain(missing);
        }
      },
    );

    // ---------------------------------------------------------------- 3
    it('C03 · valid input yields ok:true with a populated descriptor (FR-022)', async () => {
      const engine = harness.create();
      const result = await engine.generateSpecification(
        { projectName: 'Conformance', requirements: selectionOf(2) },
        context(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.producedBy.name).toBe(engine.descriptor.name);
        expect(result.producedBy.version.trim()).not.toBe('');
        expect(result.value.contentRaw.trim()).not.toBe('');
        // R-007: raw output is always retained so a parser fix needs no re-run.
        expect(typeof result.value.contentRaw).toBe('string');
      }
    });

    // ---------------------------------------------------------------- 4
    it('C04 · an empty selection is refused before work starts (E7)', async () => {
      const engine = harness.createSlow(10_000);
      const started = Date.now();
      const result = await engine.generateSpecification(
        { projectName: 'Conformance', requirements: [] },
        context({ timeoutMs: 10_000 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('empty_selection');
      // "Before work starts" is the requirement, not merely the reason.
      expect(Date.now() - started).toBeLessThan(1_000);
    });

    // ---------------------------------------------------------------- 5
    it('C05 · oversized input is refused before work starts (E7)', async () => {
      const engine = harness.createSlow(10_000);
      const started = Date.now();
      const result = await engine.generateSpecification(
        { projectName: 'Conformance', requirements: selectionOf(harness.inputCeiling + 1) },
        context({ timeoutMs: 10_000 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('input_too_large');
      expect(Date.now() - started).toBeLessThan(1_000);
    });

    // ---------------------------------------------------------------- 6
    it('C06 · cancellation mid-run yields cancelled with no artifact (E4, E3)', async () => {
      const controller = new AbortController();
      const engine = harness.createSlow(5_000);
      const pending = engine.generateSpecification(
        { projectName: 'Conformance', requirements: selectionOf(1) },
        context({ signal: controller.signal }),
      );
      controller.abort();
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('cancelled');
      expect('value' in result).toBe(false);
    });

    // ---------------------------------------------------------------- 7
    it('C07 · exceeding timeoutMs yields timeout with no artifact (E5, E3)', async () => {
      const engine = harness.createSlow(5_000);
      const result = await engine.generateSpecification(
        { projectName: 'Conformance', requirements: selectionOf(1) },
        context({ timeoutMs: 25 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.reason).toBe('timeout');
        // A timeout reported as a cancellation makes a systemic problem look
        // like ordinary user behaviour in every metric.
        expect(result.failure.reason).not.toBe('cancelled');
      }
      expect('value' in result).toBe(false);
    });

    // ---------------------------------------------------------------- 8
    it('C08 · unparseable output yields malformed_output with no artifact (E6, E3)', async () => {
      const result = await harness
        .createFailing('malformed_output')
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(1) },
          context(),
        );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('malformed_output');
      expect('value' in result).toBe(false);
    });

    // ---------------------------------------------------------------- 9
    it('C09 · empty output is a failure, never an empty specification (E6)', async () => {
      const result = await harness
        .createFailing('empty_output')
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(1) },
          context(),
        );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('empty_output');
      // The trap this closes: returning ok:true with contentRaw: '' would let a
      // silently empty specification enter the lifecycle as a real artifact.
      expect('value' in result).toBe(false);
    });

    // ---------------------------------------------------------------- 10
    it('C10 · an unreachable engine is distinct from one that ran and failed (FR-026)', async () => {
      const unavailable = await harness
        .createFailing('engine_unavailable')
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(1) },
          context(),
        );
      const errored = await harness
        .createFailing('engine_error')
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(1) },
          context(),
        );

      expect(unavailable.ok).toBe(false);
      expect(errored.ok).toBe(false);
      if (!unavailable.ok && !errored.ok) {
        expect(unavailable.failure.reason).toBe('engine_unavailable');
        expect(errored.failure.reason).toBe('engine_error');
        // "Could not start" and "ran and failed" need different responses:
        // one is retryable, the other is a defect.
        expect(unavailable.failure.reason).not.toBe(errored.failure.reason);
      }
    });

    // ---------------------------------------------------------------- 11
    it('C11 · every validation finding carries a location (FR-023)', async () => {
      const result = await harness
        .create()
        .validateSpecification({ specificationTitle: 'S', specificationContent: '   ' }, context());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length, 'an empty specification must produce at least one finding')
          .toBeGreaterThan(0);
        for (const finding of result.value) {
          // A finding without a location is malformed output — it tells a
          // reviewer something is wrong and not where.
          expect(finding.location?.trim()).toBeTruthy();
          expect(['info', 'warning', 'error']).toContain(finding.severity);
          expect(finding.message.trim()).not.toBe('');
        }
      }
    });

    // ---------------------------------------------------------------- 12
    it('C12 · nothing survives any terminal outcome (E8)', async () => {
      const input = { projectName: 'Conformance', requirements: selectionOf(1) };

      await harness.create().generateSpecification(input, context());
      await harness.assertNothingLeftBehind();

      await harness.createFailing('engine_error').generateSpecification(input, context());
      await harness.assertNothingLeftBehind();

      await harness.createSlow(5_000).generateSpecification(input, context({ timeoutMs: 25 }));
      await harness.assertNothingLeftBehind();

      const controller = new AbortController();
      const cancelled = harness
        .createSlow(5_000)
        .generateSpecification(input, context({ signal: controller.signal }));
      controller.abort();
      await cancelled;
      await harness.assertNothingLeftBehind();
    });

    // ---------------------------------------------------------------- 13
    it('C13 · no credential appears in any message, diagnostic, or output (E9)', async () => {
      const input = { projectName: 'Conformance', requirements: selectionOf(1) };
      const surfaces: string[] = [];

      const ok = await harness.create().generateSpecification(input, context());
      if (ok.ok) surfaces.push(ok.value.contentRaw, JSON.stringify(ok.value.contentParsed));

      for (const reason of [
        'engine_unavailable',
        'engine_error',
        'malformed_output',
        'empty_output',
      ] as const) {
        const failed = await harness.createFailing(reason).generateSpecification(input, context());
        if (!failed.ok) {
          surfaces.push(failed.failure.message, failed.failure.diagnostics ?? '');
        }
      }

      for (const surface of surfaces) {
        expect(surface, 'the credential probe leaked').not.toContain(harness.secretProbe);
        for (const pattern of CREDENTIAL_PATTERNS) {
          expect(pattern.test(surface), `matched credential pattern ${pattern}`).toBe(false);
        }
      }
    });

    // ------------------------------------------------------ 14 (EPIC-019)
    it('C14 · absent steering is byte-identical to the pre-steering baseline (S4)', async () => {
      const input = { projectName: 'Conformance', requirements: selectionOf(2) };

      const baseline = await harness.create().generateSpecification(input, context());
      const absent = await harness.create().generateSpecification({ ...input }, context());
      const empty = await harness
        .create()
        .generateSpecification({ ...input, steering: [] }, context());

      expect(baseline.ok && absent.ok && empty.ok).toBe(true);
      if (baseline.ok && absent.ok && empty.ok) {
        // Steering is ADDITIVE: no steering — whether the field is missing or
        // empty — must leave the output exactly as it was before the field
        // existed. This is what keeps every pre-steering case valid.
        expect(absent.value.contentRaw).toBe(baseline.value.contentRaw);
        expect(empty.value.contentRaw).toBe(baseline.value.contentRaw);
      }
    });

    // ------------------------------------------------------ 15 (EPIC-019)
    it('C15 · structured steering is consumed with no platform-side formatting (S1, S3)', async () => {
      const steering: SteeringInput[] = [
        {
          subject: 'coding_standards',
          scopeType: 'organization',
          content: 'All services are framework-free.',
          version: 1,
        },
        {
          subject: 'technology_stack',
          scopeType: 'project',
          content: 'PostgreSQL and Valkey only.',
          version: 3,
        },
      ];
      // What the platform hands over IS the wire format: plain, ordered data.
      expect(JSON.parse(JSON.stringify(steering))).toEqual(steering);
      expect(isSteeringOrdered(steering)).toBe(true);

      const snapshot = JSON.parse(JSON.stringify(steering)) as unknown;
      const result = await harness
        .create()
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(2), steering },
          context(),
        );

      expect(result.ok, 'an adapter must accept structured steering').toBe(true);
      // The adapter consumed the array; it did not reach back and reformat the
      // platform's data — any engine-specific rendering happened on ITS side.
      expect(steering).toEqual(snapshot);
    });

    // ------------------------------------------------------ 16 (EPIC-019)
    it('C16 · a steering violation is a FINDING, not a failure (S6)', async () => {
      const steering: SteeringInput[] = [
        {
          subject: 'security',
          scopeType: 'organization',
          content: 'Never store passwords in plaintext.',
          version: 2,
        },
      ];
      const result = await harness
        .createSteeringViolating()
        .generateSpecification(
          { projectName: 'Conformance', requirements: selectionOf(1), steering },
          context(),
        );

      // A specification that violates a standard is still a specification.
      expect(result.ok, 'a violation must not fail the generation').toBe(true);
      if (result.ok) {
        const findings = result.value.findings ?? [];
        expect(findings.length, 'the violation must surface as a finding').toBeGreaterThan(0);
        for (const finding of findings) {
          expect(finding.location?.trim()).toBeTruthy();
          expect(['info', 'warning', 'error']).toContain(finding.severity);
          expect(finding.message.trim()).not.toBe('');
        }
        // The finding is actionable: it names the violated subject.
        expect(
          findings.some((finding) =>
            steering.some((s) => finding.message.includes(s.subject)),
          ),
        ).toBe(true);
      }
    });
  });
}
