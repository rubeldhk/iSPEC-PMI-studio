/**
 * `T2146` (EPIC-039, `FR-HUB-016`, `FR-HUB-081`) — the Hub decides whether an
 * adapter's output conforms, and refuses a non-conforming one as an adapter
 * fault. It is never passed through: a caller written against the contract
 * would otherwise receive whatever a provider happened to send.
 *
 * `Embed` adds the four refusals `EPIC-038`'s `embedChecked` applies — a count
 * mismatch, a wrong dimension, a non-finite component, a zero vector — so a
 * bad batch is refused here, recorded as `adapter-fault`, before the port
 * would refuse it again.
 *
 * `T2621` (`FR-HUB-045`) — an output carrying recognisable credential material
 * is refused the same way, before it is returned, recorded or contributed as
 * evidence. The refusal names where the material was, never the material.
 */
import { findSecret, validate, type CapabilityContractDocument } from '@pmi/capability-contract';

export type OutputCheck = { ok: true } | { ok: false; errorCategory: 'adapter-fault'; message: string };

export interface EmbedExpectation {
  readonly texts: number;
  readonly dimension: number;
}

function fault(message: string): OutputCheck {
  return { ok: false, errorCategory: 'adapter-fault', message: `the adapter's output does not conform to the contract: ${message}` };
}

export function checkOutput(contract: CapabilityContractDocument, output: unknown, embed?: EmbedExpectation): OutputCheck {
  const v = validate(contract.outputSchema, output);
  if (!v.ok) return fault(v.errors.map((e) => `${e.path} ${e.message}`).join('; '));
  const secret = findSecret(output);
  if (secret !== null) {
    return { ok: false, errorCategory: 'adapter-fault', message: `the adapter's output carries credential material at ${secret}; it is refused, never returned or recorded (FR-HUB-045)` };
  }
  if (contract.name === 'Embed' && embed !== undefined) {
    const o = output as { model: { dimension: number }; vectors: number[][] };
    if (o.vectors.length !== embed.texts) return fault(`returned ${o.vectors.length} vectors for ${embed.texts} texts`);
    if (o.model.dimension !== embed.dimension) return fault(`reported dimension ${o.model.dimension}, declared ${embed.dimension}`);
    for (const [i, vector] of o.vectors.entries()) {
      if (vector.length !== embed.dimension) return fault(`vector ${i} has dimension ${vector.length}, declared ${embed.dimension}`);
      if (!vector.every((x) => Number.isFinite(x))) return fault(`vector ${i} has a non-finite component`);
      if (vector.every((x) => x === 0)) return fault(`vector ${i} is a zero vector, which every candidate is equally near`);
    }
  }
  return { ok: true };
}
