/**
 * The shape every tool in this server is declared with. `server.ts` turns a
 * `ToolSpec` into an SDK registration; the specs themselves hold no logic
 * beyond naming their route (`FR-PIC-011`).
 */
import { z, type ZodRawShape, type ZodTypeAny } from 'zod';

export type Args = Record<string, unknown>;

export interface RouteCall {
  readonly method: 'GET' | 'POST';
  readonly path: string;
}

export interface ToolSpec {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: ZodRawShape;
  readonly output: ZodTypeAny;
  readonly mutating: boolean;
  /** The route the arguments translate to. */
  readonly route: (args: Args) => RouteCall;
  /** A second read performed beside the first (history + snapshot). */
  readonly also?: (args: Args) => RouteCall;
  /** Argument names consumed by the path and therefore not sent in the body. */
  readonly strip?: readonly string[];
  /** True when `correlationId` travels as a header rather than in the body (append, complete, comment). */
  readonly correlationAsHeader?: boolean;
}

/** An object schema that keeps every key the platform returns; the contract, not this server, owns the shape. */
export function passthroughObject(shape: ZodRawShape): ZodTypeAny {
  return z.object(shape).passthrough();
}
