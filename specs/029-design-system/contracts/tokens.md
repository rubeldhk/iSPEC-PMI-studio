# Contract: Token Layer

**EPIC-029** · Phase 1 · the interface `frontend/src/design/tokens.css` exposes to everything else

This is a **contract**, not an implementation: it fixes the names, the categories and the rules a
consumer may rely on. Values are chosen during implementation (`FR-DS-005` — a neutral system
palette this Epic derives) and may change without breaking a consumer, which is the entire point of
naming them.

## Categories and naming

`--<category>-<scale>`. A consumer reads tokens; nothing else.

| Category | Shape | Notes |
|---|---|---|
| `color` | `--color-<role>[-<variant>]` | roles, never hues: `--color-text`, `--color-text-muted`, `--color-surface`, `--color-border`, `--color-accent`, `--color-danger`, `--color-success`, `--color-warning`. **All themed.** A token named for a hue (`--color-blue-500`) would leak the palette into every consumer and defeat re-theming |
| `space` | `--space-0` … `--space-8` | fixed ratio scale (`FR-DS-003`). Never themed |
| `type` | `--type-<step>-size`, `-line`, `-weight` | at most **seven** steps (`FR-DS-004`) |
| `radius` | `--radius-sm` \| `-md` \| `-lg` \| `-full` | |
| `elevation` | `--elevation-0` … `--elevation-3` | themed — shadows differ on dark surfaces |
| `motion` | `--motion-fast`, `--motion-base`, `--motion-slow` | durations; suppressed under `prefers-reduced-motion` |

## Guarantees

1. **Single definition** — every token is declared exactly once (`FR-DS-002`). Two declarations is
   the drift this layer exists to prevent, and the conformance check fails on it.
2. **Theme completeness** — every themed token has a value in light *and* dark (`FR-DS-010`).
3. **Contrast** — every text-on-surface pair meets WCAG 2.2 AA in both themes (`SC-DS-007`),
   computed from these values.
4. **Stability of names** — a consumer may depend on a token *name*. Renaming one is a breaking
   change to this contract; changing its *value* is not.
5. **No literals downstream** — consumers may not declare visual literals (`FR-DS-051`, enforced by
   lint). This is the obligation the contract places on its consumers, stated here so it is part of
   the bargain rather than a rule imposed elsewhere.

## Theme selection

| Condition | Result |
|---|---|
| No stored preference | follow `prefers-color-scheme` (`FR-DS-011`) |
| Stored preference `light` \| `dark` | that theme, regardless of OS |
| Stored preference cleared | return to following the OS |
| `prefers-reduced-motion: reduce` | `motion` durations resolve to `0`, layout unchanged |

## What this contract does NOT cover

- Concrete values — implementation, and deliberately replaceable (`FR-DS-005`).
- Component appearance — [components.md](./components.md).
- Whether components are built or adopted — decision `D-42`.
