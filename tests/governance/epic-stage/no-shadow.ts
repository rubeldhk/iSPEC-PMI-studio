/**
 * T493 — reject derivable keys anywhere in the declarations (`DF-7`).
 *
 * `epic-declarations.json` is the only hand-authored input to the register, and
 * therefore the only place the register can be lied to. Everything else is
 * derived from the file tree and cannot disagree with it.
 *
 * Without this rule the file becomes a hand-maintained shadow register — the
 * exact artifact this epic exists to abolish, reintroduced through the single
 * door that had to stay open. It would not arrive as a decision: someone adds
 * `"stage": "Ready"` to unblock themselves once, and from then on the repository
 * has two answers to "what stage is this Epic at" and no way to tell which is
 * real.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */

/**
 * Keys the tree already knows.
 *
 * Deliberately short. Every addition here is a word an author may not use, so
 * the list covers what the register actually derives and stops.
 */
export const DERIVED_KEYS = ['stage', 'readiness', 'next'] as const;

/**
 * Every derivable key in the structure, with its path.
 *
 * **Recursive**, because a `stage` nested three levels inside a posture object
 * is the same lie in a quieter voice. **Exhaustive**, because reporting only the
 * first offender means an author fixes one and reruns to find the next — the
 * same reasoning `FR-ESK-013` applies to the DOR.
 *
 * Matches are **exact key names**, not substrings: `nextReviewOwner` is not a
 * next command, and rejecting it would push authors toward worse names to
 * satisfy a checker.
 */
export function findDerivedKeys(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findDerivedKeys(entry, [...path, String(index)]));
  }

  if (value === null || typeof value !== 'object') return [];

  const found: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const here = [...path, key];
    if ((DERIVED_KEYS as readonly string[]).includes(key)) {
      found.push(
        `${here.join('.')} — "${key}" is derived from the file tree and must not be declared (DF-7)`,
      );
      // Not descending into a rejected key: its contents are part of the same
      // fault, and listing them would bury the finding that matters.
      continue;
    }
    found.push(...findDerivedKeys(nested, here));
  }
  return found;
}
