/**
 * `T2110` (EPIC-039, `R-039-3`) — a JSON Schema 2020-12 **subset** and its
 * validator, with no runtime dependency.
 *
 * The subset is the keywords a reviewer can reason about and the conformance
 * check can compare between minors. Anything else is refused by name: a
 * contract that grows `oneOf` or `$ref` has grown a feature nothing checks.
 *
 * `minItems` and `minLength` are the two lower bounds beyond `R-039-3`'s list,
 * added because `FR-HUB-083` ("1 to 64 texts, each 1 to 8,000 characters")
 * and `SendNotification`'s 1–20 recipients cannot be stated without them.
 * `description` is an annotation and changes nothing.
 */

export type JsonType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';

export interface JsonSchema {
  type?: JsonType;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  enum?: readonly (string | number | boolean)[];
  maxItems?: number;
  minItems?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

export const SUPPORTED_KEYWORDS = Object.freeze([
  'type',
  'description',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'maxItems',
  'minItems',
  'maxLength',
  'minLength',
  'pattern',
] as const);

function at(path: string): string {
  return path === '' ? '(root)' : path;
}

function join(path: string, key: string | number): string {
  return path === '' ? String(key) : `${path}.${key}`;
}

/** Every keyword outside the subset, as `<keyword> at <path>`; empty when the schema conforms. */
export function unsupportedKeywords(schema: JsonSchema, path = ''): string[] {
  const found: string[] = [];
  if (schema === null || typeof schema !== 'object') return [`non-object schema at ${at(path)}`];
  for (const [key, value] of Object.entries(schema)) {
    if (!(SUPPORTED_KEYWORDS as readonly string[]).includes(key)) {
      found.push(`${key} at ${at(path)}`);
      continue;
    }
    if (key === 'additionalProperties' && value !== false) found.push(`additionalProperties: ${JSON.stringify(value)} at ${at(path)}`);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    found.push(...unsupportedKeywords(child, join(join(path, 'properties'), name)));
  }
  if (schema.items !== undefined) found.push(...unsupportedKeywords(schema.items, join(path, 'items')));
  return found;
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

function typeError(expected: JsonType, value: unknown): string | null {
  switch (expected) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) ? null : 'must be an object';
    case 'array':
      return Array.isArray(value) ? null : 'must be an array';
    case 'string':
      return typeof value === 'string' ? null : 'must be a string';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'must be a finite number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) ? null : 'must be an integer';
  }
}

function check(schema: JsonSchema, value: unknown, path: string, errors: ValidationError[]): void {
  if (schema.type !== undefined) {
    const wrong = typeError(schema.type, value);
    if (wrong !== null) {
      errors.push({ path: at(path), message: wrong });
      return;
    }
  }
  if (schema.enum !== undefined && !schema.enum.includes(value as string)) {
    errors.push({ path: at(path), message: `must be one of ${schema.enum.join(', ')}` });
  }
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push({ path: at(path), message: `must be at most ${schema.maxLength} characters` });
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push({ path: at(path), message: `must be at least ${schema.minLength} characters` });
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) errors.push({ path: at(path), message: `must match the pattern ${schema.pattern}` });
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push({ path: at(path), message: `must have at most ${schema.maxItems} items` });
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ path: at(path), message: `must have at least ${schema.minItems} items` });
    if (schema.items !== undefined) value.forEach((item, i) => check(schema.items!, item, join(path, i), errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const name of schema.required ?? []) {
      if (record[name] === undefined) errors.push({ path: join(path, name), message: 'is required' });
    }
    for (const [name, child] of Object.entries(record)) {
      const childSchema = schema.properties?.[name];
      if (childSchema === undefined) {
        if (schema.additionalProperties === false) errors.push({ path: join(path, name), message: 'is not allowed by the contract' });
        continue;
      }
      if (child === undefined) continue;
      check(childSchema, child, join(path, name), errors);
    }
  }
}

/** Validate a value against a subset schema; every error names its path. */
export function validate(schema: JsonSchema, value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  check(schema, value, '', errors);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
