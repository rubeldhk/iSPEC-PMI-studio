/**
 * `T2116` (EPIC-039, `FR-HUB-023`) — a field is a value or a reason.
 *
 * There is no third shape: `{ applicable: true }` and `{ applicable: false }`
 * do not type-check, and `notApplicable('')` throws. The screen renders the two
 * branches differently (`FR-HUB-073`), so a blank cannot be shown as a value.
 */
export type Fact<T> = { readonly applicable: true; readonly value: T } | { readonly applicable: false; readonly reason: string };

export function fact<T>(value: T): Fact<T> {
  return { applicable: true, value };
}

export function notApplicable<T = never>(reason: string): Fact<T> {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('A not-applicable field requires a reason; a blank is not a reason (FR-HUB-023).');
  }
  return { applicable: false, reason };
}

export function isFact(value: unknown): value is Fact<unknown> {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v['applicable'] === true) return 'value' in v;
  if (v['applicable'] === false) return typeof v['reason'] === 'string' && (v['reason'] as string).trim() !== '';
  return false;
}
