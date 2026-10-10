/**
 * T766 — precedence is quoted, not restated. `FR-DPE-042`, `BR-0071`, `R-031-1`.
 *
 * Where rules at different scopes conflicted, the explanation names the
 * precedence decision — and takes it **verbatim** from what `resolveSteering()`
 * returned through the steering source, rather than reconstructing an argument
 * of its own that could drift from `EPIC-019`'s.
 */
import { describe, expect, it } from 'vitest';
import { engine, request, rules } from '../helpers/decision-engine.js';

describe('T766 · FR-DPE-042 — the precedence resolution travels into the explanation verbatim', () => {
  it('quotes the steering source’s precedence string exactly', async () => {
    const quoted = 'project v2 overrides workspace v5 — the narrower scope wins (BR-0071)';
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }], quoted) });
    const result = await e.decide(request());
    expect(result.explanation.precedenceResolution).toBe(quoted);
  });

  it('omits it when nothing conflicted — absence means there was nothing to resolve', async () => {
    const { engine: e } = engine({ steering: rules([{ actionPattern: 'deploy', band: 'low' }]) });
    const result = await e.decide(request());
    expect(result.explanation.precedenceResolution).toBeUndefined();
  });
});
