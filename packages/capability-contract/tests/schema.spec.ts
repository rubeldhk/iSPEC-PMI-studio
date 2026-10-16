/**
 * `T2109` (EPIC-039, `R-039-3`) — the JSON Schema subset and its validator.
 *
 * A capability contract is a reviewed document. A keyword the conformance
 * check cannot reason about would let a contract grow features nobody checks,
 * so any keyword outside the subset is refused **by name**.
 *
 * Written to FAIL before `T2110`.
 */
import { describe, expect, it } from 'vitest';
import { SUPPORTED_KEYWORDS, unsupportedKeywords, validate, type JsonSchema } from '../src/schema.js';

const schema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['revision', 'mode'],
  properties: {
    revision: { type: 'string', maxLength: 64, pattern: '^[0-9a-f]+$' },
    mode: { type: 'string', enum: ['tree', 'files'] },
    paths: { type: 'array', maxItems: 2, items: { type: 'string', minLength: 1 } },
    count: { type: 'integer' },
    ratio: { type: 'number' },
    flag: { type: 'boolean' },
  },
};

describe('T2109 · the subset', () => {
  it('lists exactly the keywords R-039-3 allows, plus the two lower bounds FR-HUB-083 needs', () => {
    expect([...SUPPORTED_KEYWORDS].sort()).toEqual(
      ['additionalProperties', 'description', 'enum', 'items', 'maxItems', 'maxLength', 'minItems', 'minLength', 'pattern', 'properties', 'required', 'type'].sort(),
    );
  });

  it('accepts a schema written in the subset', () => {
    expect(unsupportedKeywords(schema)).toEqual([]);
  });

  it('refuses any other keyword by name and path', () => {
    const bad = { type: 'object', properties: { a: { type: 'string', format: 'email' }, b: { oneOf: [] } }, $ref: '#/x' } as unknown as JsonSchema;
    expect(unsupportedKeywords(bad)).toEqual(['$ref at (root)', 'format at properties.a', 'oneOf at properties.b']);
  });

  it('refuses additionalProperties: true — only false is in the subset', () => {
    expect(unsupportedKeywords({ type: 'object', additionalProperties: true } as unknown as JsonSchema)).toEqual(['additionalProperties: true at (root)']);
  });
});

describe('T2109 · validation names the path', () => {
  it('accepts a conforming value', () => {
    expect(validate(schema, { revision: 'abc123', mode: 'tree', paths: ['a'], count: 2, ratio: 0.5, flag: true })).toEqual({ ok: true });
  });

  it.each([
    [{ mode: 'tree' }, 'revision', 'required'],
    [{ revision: 'abc', mode: 'blob' }, 'mode', 'one of'],
    [{ revision: 'XYZ', mode: 'tree' }, 'revision', 'pattern'],
    [{ revision: 'a'.repeat(65), mode: 'tree' }, 'revision', 'at most 64'],
    [{ revision: 'abc', mode: 'tree', paths: ['a', 'b', 'c'] }, 'paths', 'at most 2'],
    [{ revision: 'abc', mode: 'tree', paths: [''] }, 'paths.0', 'at least 1'],
    [{ revision: 'abc', mode: 'tree', count: 1.5 }, 'count', 'integer'],
    [{ revision: 'abc', mode: 'tree', ratio: Number.NaN }, 'ratio', 'number'],
    [{ revision: 'abc', mode: 'tree', extra: 1 }, 'extra', 'not allowed'],
    [{ revision: 1, mode: 'tree' }, 'revision', 'string'],
  ])('refuses %j at %s (%s)', (value, path, fragment) => {
    const result = validate(schema, value);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const hit = result.errors.find((e) => e.path === path);
    expect(hit, JSON.stringify(result.errors)).toBeDefined();
    expect(hit!.message).toContain(fragment);
  });

  it('refuses a non-object where an object is required', () => {
    const result = validate(schema, null);
    expect(result).toMatchObject({ ok: false, errors: [{ path: '(root)' }] });
  });
});
