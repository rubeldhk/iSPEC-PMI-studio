/**
 * T993h — the stage vocabulary. `FR-GEL-001`, `FR-GEL-002`.
 *
 * Event → Context → Analyze → Decide → Execute → Verify → Evidence → Outcome,
 * and then the next Event. Eight stages, one definition, exported by reference.
 *
 * **Why this is a tuple and not a union of string literals.** A consumer needs
 * to iterate the stages in order to render a progress projection
 * (`FR-GEL-050`), and a union gives it nothing to iterate — so every consumer
 * would rebuild the order from memory, which is how three Rooms end up
 * disagreeing about where `Verify` sits. The type is derived from the tuple, so
 * the order and the vocabulary cannot drift apart.
 *
 * **Why it is frozen.** `as const` is a compile-time promise and nothing else;
 * after erasure the array is ordinary and mutable, and a consumer that sorted or
 * pushed to it would change the loop for every workflow type in the process.
 */

export const LOOP_STAGES = Object.freeze([
  'Event',
  'Context',
  'Analyze',
  'Decide',
  'Execute',
  'Verify',
  'Evidence',
  'Outcome',
] as const);

export type LoopStage = (typeof LOOP_STAGES)[number];

/**
 * Narrow an untrusted string to a stage, or refuse it.
 *
 * The configuration loader's entry point for `FR-GEL-007`: a file naming a
 * stage outside this vocabulary must fail to load rather than resolve to a
 * default. There is deliberately no `parseLoopStage` returning a fallback —
 * a fallback stage is a workflow silently running a loop nobody configured.
 */
export function isLoopStage(candidate: string): candidate is LoopStage {
  return (LOOP_STAGES as readonly string[]).includes(candidate);
}
