/**
 * T913 (EPIC-029) — the control that makes FR-DS-011's override reachable.
 *
 * Convergence finding F1: `theme.ts` was built and unit-tested while nothing
 * called it — no `initTheme` at the root, no control invoking `setTheme` — so
 * a user of the running application could not set or persist a theme. The OS
 * default worked, which is exactly why it went unnoticed: that path is pure
 * CSS and renders correctly with zero JavaScript.
 *
 * Composed from the Phase 1 inventory (FormField + Select), not built from
 * scratch — it is an application composition, not a sixteenth primitive,
 * which is why it lives beside `theme.ts` rather than in `components/`.
 *
 * "Follow system" is the empty value deliberately: clearing the override is a
 * real choice, and the contract (contracts/tokens.md · Theme selection) says
 * a cleared preference returns to the OS.
 *
 * Unit tests: tests/unit/design/theme-control.spec.tsx; wired-ness is asserted
 * against the COMPOSED app in tests/unit/design/app-root.spec.tsx (T913).
 */
import { useState, type ReactElement } from 'react';
import { FormField } from './components/FormField';
import { Select } from './components/Select';
import { clearTheme, getStoredTheme, setTheme, type ThemePreference } from './theme';

/** '' is "follow the operating system" — the absence of an override. */
type Choice = '' | ThemePreference;

export function ThemeControl(): ReactElement {
  const [choice, setChoice] = useState<Choice>(() => getStoredTheme() ?? '');

  function choose(next: Choice): void {
    setChoice(next);
    if (next === '') clearTheme();
    else setTheme(next);
  }

  return (
    <FormField id="theme-control" label="Theme">
      <Select value={choice} onChange={(e) => choose(e.target.value as Choice)}>
        <option value="">Follow system</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </Select>
    </FormField>
  );
}
