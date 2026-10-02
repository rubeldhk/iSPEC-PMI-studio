/**
 * Refusals, one vocabulary rendered for MCP (`R-043-5`): a tool result with
 * `isError: true` and `structuredContent { code, message, …detail }` — never a
 * protocol error, because a refused registration is a governed outcome the
 * caller must record (`EPIC-037` `R-037-7`).
 *
 * Nothing here ever carries a credential (`FR-PIC-026`): every message and
 * every detail passes through `sanitise()` before it is rendered.
 */

export interface Refusal {
  readonly code: string;
  readonly message: string;
  readonly [detail: string]: unknown;
}

export interface ToolRefusalResult {
  readonly isError: true;
  readonly content: { readonly type: 'text'; readonly text: string }[];
  readonly structuredContent: Refusal;
}

/** Shapes that are credentials wherever they appear: ours, and the common API-key forms. */
const CREDENTIAL_SHAPES = [
  // The bearer form first, so "Bearer pmi_ct_…" collapses to one placeholder.
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g,
  /pmi_ct_[A-Za-z0-9_-]{20,}/g,
  /\bsk-ant-[A-Za-z0-9-]{16,}\b/g,
  /\bsk-[A-Za-z0-9-]{16,}\b/g,
];

export function sanitise(text: string): string {
  let out = text;
  for (const shape of CREDENTIAL_SHAPES) out = out.replace(shape, '<credential>');
  return out;
}

/** True when a value, anywhere inside `input`, is credential-shaped; returns the path of the first. */
export function credentialInArguments(input: unknown, path = ''): string | null {
  if (typeof input === 'string') {
    return CREDENTIAL_SHAPES.some((shape) => new RegExp(shape.source).test(input)) ? path || '(root)' : null;
  }
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      const hit = credentialInArguments(input[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (input !== null && typeof input === 'object') {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const hit = credentialInArguments(value, path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
  }
  return null;
}

export function refuse(code: string, message: string, detail: Record<string, unknown> = {}): ToolRefusalResult {
  const safeDetail: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) safeDetail[k] = typeof v === 'string' ? sanitise(v) : v;
  const structuredContent: Refusal = { code, message: sanitise(message), ...safeDetail };
  return {
    isError: true,
    content: [{ type: 'text', text: `${code}: ${structuredContent.message}` }],
    structuredContent,
  };
}

export const INVALID_CREDENTIAL_MESSAGE = 'Invalid connector credential.';
