/**
 * Types for the register projection generator.
 *
 * `build-register.mjs` is plain ESM — `scripts/` has no build step and adding
 * one for a single generator would be a technology decision this epic has no
 * mandate to take (`FR-AMD-016`). A hand-written declaration keeps
 * `pnpm typecheck:governance` honest without pulling the script into a
 * TypeScript toolchain.
 *
 * Only the surface the governance checks import is declared. The generator's
 * internals stay untyped on purpose: they are covered by
 * `scripts/tests/build-register.spec.mjs`, and declaring them here would create
 * a second definition to keep in step with the first.
 */

/** Thrown when a row does not match its header. Never swallowed — see the generator. */
export declare class MalformedRowError extends Error {
  constructor(message: string);
}

export interface RegisterOption {
  readonly label: string;
  readonly consequence: string;
}

/** A parsed register row. Field names come from the markdown table header. */
export type RegisterRow = Record<string, unknown>;

export interface RegisterProjection {
  readonly version: string;
  readonly generated_from: Record<string, string>;
  readonly clauses: RegisterRow[];
  readonly verdicts: RegisterRow[];
  readonly capabilities: RegisterRow[];
  readonly capability_areas: RegisterRow[];
  readonly premises: RegisterRow[];
  readonly decisions: RegisterRow[];
  readonly research: RegisterRow[];
  readonly adrs: RegisterRow[];
  readonly preserved_element_changes: RegisterRow[];
  readonly epic_status_changes: RegisterRow[];
  readonly impact_report: {
    readonly sections: number;
    readonly empty_with_reason: string[];
    readonly placeholders: number;
  };
}

export declare const REPO_ROOT: string;
export declare const REGISTER_DIR: string;
export declare const IMPACT_REPORT: string;
export declare const PROJECTION: string;

export declare function parseTable(markdown: string): string[][];
export declare function parseScalar(cell: string): string | number | boolean | null;
export declare function parseList(cell: string): string[];
export declare function parseOptions(cell: string): RegisterOption[];
export declare function rowsToObjects(rows: string[][]): RegisterRow[];

/** Build the projection in memory. Side-effect free; the CLI entry point writes it. */
export declare function buildRegister(): RegisterProjection;
