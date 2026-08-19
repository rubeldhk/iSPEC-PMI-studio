/**
 * T333 · Check G-09 — the closing-report format defines both mandatory sections and states
 * the honesty rule (FR-RGP-015, Constitution IX).
 *
 * The honesty rule is the clause that makes a closing report worth reading. Without it the
 * format produces a document that always says "done", which is worse than no document —
 * it manufactures confidence rather than reporting it.
 */
import { describe, it, expect } from 'vitest';
import { read } from './helpers';

const doc = read('governance/closing-report.md');

describe('G-09 · closing report format (FR-RGP-015, Constitution IX)', () => {
  it('defines both mandatory sections', () => {
    expect(doc).toMatch(/## Work Completed/);
    expect(doc).toMatch(/## Recommended Next Task/);
    expect(doc).toMatch(/mandatory/i);
  });

  it('states that an unrun check is never reported as passing', () => {
    expect(doc).toMatch(/never reported as passing|not reported as passing/i);
    expect(doc).toMatch(/unrun|not run|was not executed/i);
  });

  it('states that deferred work is never reported as complete', () => {
    expect(doc).toMatch(/deferred/i);
    expect(doc).toMatch(/never reported as complete|not reported as complete/i);
  });

  it('requires each completion claim to name its evidence', () => {
    expect(doc).toMatch(/## The honesty rule/);
    expect(doc).toMatch(/evidence/i);
  });

  it('publishes a template a report can be written against', () => {
    const template = /```markdown\r?\n([\s\S]*?)```/.exec(doc)?.[1] ?? '';
    expect(template, 'the format publishes no usable template').toContain('## Work Completed');
    expect(template).toContain('## Recommended Next Task');
  });

  it('says what to do when nothing is recommended next', () => {
    expect(doc).toMatch(/## When there is no next task/);
  });
});
