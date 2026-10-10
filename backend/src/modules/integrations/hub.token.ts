/** EPIC-039 — the composed Integration Hub, as one injection token (its own file, so controllers avoid a cycle). */
export const HUB = Symbol('INTEGRATION_HUB');
