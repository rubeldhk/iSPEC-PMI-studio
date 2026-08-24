/**
 * T874 (EPIC-029) — theme selection and persistence (FR-DS-011, SC-DS-005).
 * Unit tests: tests/unit/design/theme.spec.tsx (T873).
 *
 * The division of labour: CSS owns the OS default (themes.css carries a
 * `prefers-color-scheme` media block), so this module's whole job is the
 * EXPLICIT override — writing `data-theme` on the root element and remembering
 * it. No attribute means the OS governs, which is why clearTheme removes the
 * attribute rather than computing what the OS would have chosen.
 */

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'pmi.theme';

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/** The stored explicit preference, or null when the OS governs. */
export function getStoredTheme(): ThemePreference | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : null;
  } catch {
    // Storage unavailable (private mode, blocked) — behave as "no override".
    return null;
  }
}

/**
 * Pure resolution, exported so the precedence rule is testable without a DOM:
 * an explicit preference wins; otherwise the OS.
 */
export function resolveTheme(
  stored: ThemePreference | null,
  osPrefersDark: boolean,
): ThemePreference {
  return stored ?? (osPrefersDark ? 'dark' : 'light');
}

/** Apply and persist an explicit override — it wins regardless of the OS. */
export function setTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Persistence is best-effort; the attribute still applies this session.
  }
  document.documentElement.dataset['theme'] = preference;
}

/** Drop the override: storage and attribute both go, the OS takes back over. */
export function clearTheme(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored anywhere reachable; the attribute removal is what matters.
  }
  delete document.documentElement.dataset['theme'];
}

/** On load: restore a stored override, or leave the OS in charge. */
export function initTheme(): void {
  const stored = getStoredTheme();
  if (stored) {
    document.documentElement.dataset['theme'] = stored;
  } else {
    delete document.documentElement.dataset['theme'];
  }
}
