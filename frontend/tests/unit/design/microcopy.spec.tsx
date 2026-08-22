/**
 * T888a (EPIC-029) — the testable half of FR-DS-042: a control's label states
 * what happens, and its confirmation states what happened — `Save` pairs with
 * `Saved`, never a generic `Success`. Per analysis `C1`, the other half
 * ("name things as users recognise them") is not mechanically testable and
 * lives in PMI-DOC-005 as a standing convention.
 *
 * Mechanically enforceable pieces:
 *  1. components never substitute generic copy for the caller's words —
 *     Button keeps its label through loading, Toast renders exactly its
 *     message;
 *  2. no delivered surface ships a generic confirmation — the corpus scan
 *     bans the words FR-DS-042 exists to keep out, and its helper is
 *     mutation-tested so the ban provably bites.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../../../src/design/components/Button';
import { Toast } from '../../../src/design/components/Toast';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../../src');

/** Generic confirmations a specific one must replace (FR-DS-042). */
export function genericConfirmations(source: string): string[] {
  return [...source.matchAll(/(['"`>])\s*(Success(?:ful(?:ly)?)?!?|Operation (?:complete|completed|succeeded)|Done!)\s*(['"`<])/g)].map(
    (m) => m[2] as string,
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|css)$/.test(entry) ? [p] : [];
  });
}

afterEach(cleanup);

describe('T888a · components carry the caller’s words, never their own', () => {
  it('a Save button stays "Save" while saving — the label survives loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button').textContent).toContain('Save');
  });

  it('a confirmation toast says exactly what happened', () => {
    render(<Toast message="Requirement saved" />);
    expect(screen.getByRole('status').textContent).toContain('Requirement saved');
    expect(screen.getByRole('status').textContent).not.toMatch(/success/i);
  });
});

describe('T888a · MUTATION — the generic-copy detector can fail', () => {
  it("flags '>Success!<' in a source fixture", () => {
    expect(genericConfirmations('<p role="status">Success!</p>')).toContain('Success!');
    expect(genericConfirmations("toast('Successfully')")).toContain('Successfully');
  });

  it('passes specific confirmations', () => {
    expect(genericConfirmations("toast('Requirement saved')")).toEqual([]);
    expect(genericConfirmations('<p role="status">Project created</p>')).toEqual([]);
  });
});

/** Comments are not UI copy — a doc comment QUOTING the banned word is fine. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('T888a · no delivered surface ships a generic confirmation', () => {
  it('frontend/src is free of them', () => {
    const offending = walk(SRC)
      .map((file) => ({ file, hits: genericConfirmations(stripComments(readFileSync(file, 'utf8'))) }))
      .filter(({ hits }) => hits.length > 0);
    expect(offending, 'generic confirmations — say what happened instead (FR-DS-042)').toEqual([]);
  });
});
