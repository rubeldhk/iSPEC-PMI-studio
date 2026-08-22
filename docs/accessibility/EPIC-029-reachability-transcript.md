# EPIC-029 reachability transcript — Constitution XI Tier 2 (T900a)

**Provenance**: every entry below was emitted by an in-page driver executing against the running
application at `http://localhost:5174` (the EPIC-029 worktree frontend, Vite dev server, proxying
`/v1` to the running backend on `:3000`) in Chrome 151 via CDP on 2026-08-21. The driver walked the
UI itself — filled the sign-in form through the DOM, clicked the rendered buttons, read
`getComputedStyle` — and appended one JSON record per step as it went. The records are reproduced
**verbatim**; nothing was written by hand. Steps 9–15 include the discovery, fix and re-measurement
of `DEF-029-002` (horizontal overflow at 360×640 with 200% zoom), left in place because a
transcript that only lists passes reads as more evidence than it is.

Signed in as the local UAT fixture user (`uat@pmi.test`, workspace `ws_uat` — provisioning recorded
in `DEF-005-001` and the EPIC-005 closure).

```json
[
{"step":"run start","at":"2026-08-21T21:33:02.855Z","url":"http://localhost:5174/","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36","viewport":"1536x695"},
{"step":"SignIn page rendered from the design system","at":"2026-08-21T21:33:02.856Z","ok":true,"heading":"PMI Studio","signInButtonClass":"ds-button ds-button--primary","resolved":{"--color-surface":"#ffffff","--space-3":"0.5625rem","bodyBackground":"rgb(255, 255, 255)"}},
{"step":"signed in, Projects page rendered","at":"2026-08-21T21:33:03.221Z","ok":true,"heading":"Projects","pageClass":"ds-page","resolved":{"bodyBackground":"rgb(255, 255, 255)"}},
{"step":"created a project to walk through","at":"2026-08-21T21:33:04.210Z"},
{"step":"project opened, Requirements page rendered","at":"2026-08-21T21:33:05.221Z","ok":true,"project":"EPIC-029 reachability","requirementsHeading":true,"filterLabels":["Name","Engine","Type","Priority","Status","Description"],"resolved":{"bodyBackground":"rgb(255, 255, 255)"}},
{"step":"theme switched: dark","at":"2026-08-21T21:33:06.233Z","resolved":{"--color-surface":"#111827","--color-text":"#e5e7eb","bodyBackground":"rgb(17, 24, 39)"}},
{"step":"theme switched: light","at":"2026-08-21T21:33:07.212Z","resolved":{"--color-surface":"#ffffff","--color-text":"#1a1d21","bodyBackground":"rgb(255, 255, 255)"}},
{"step":"run end — conditions restored","at":"2026-08-21T21:33:29.212Z"},
{"step":"window resize refused by the window manager — measuring in a true 360px layout viewport (iframe, same origin, same session) instead","at":"2026-08-21T21:34:29.361Z"},
{"step":"Projects page at 360×640 (minimum viewport, FR-DS-040)","at":"2026-08-21T21:34:30.215Z","innerViewport":"360x640","horizontalOverflow":"none"},
{"step":"Requirements page at 360×640","at":"2026-08-21T21:34:32.220Z","innerViewport":"360x640","horizontalOverflow":"none"},
{"step":"Requirements page at 360×640 and 200% text zoom (root font doubled; rem tokens scale, WCAG 1.4.4)","at":"2026-08-21T21:34:33.215Z","rootFontSize":"32px","horizontalOverflow":"488px content in 360px viewport"},
{"step":"run end — probe frame removed","at":"2026-08-21T21:34:33.228Z"},
{"step":"DEF-029-002 fix re-measured: Requirements at 360×640 and 200% text zoom","at":"2026-08-21T21:35:27.227Z","innerViewport":"360x640","rootFontSize":"32px","horizontalOverflowAt100":"none","horizontalOverflow":"384px content in 360px viewport","widerThanViewport":[]},
{"step":"DEF-029-002 fixed and re-measured across the journey at 360×640","at":"2026-08-21T21:36:22.227Z","innerViewport":"360x640","projects":{"at100":"none","at200percentZoom":"none"},"requirements":{"at100":"none","at200percentZoom":"362px content in 360px viewport"}},
{"step":"final verification: journey at 360×640, 100% and 200% zoom, dark theme included","at":"2026-08-21T21:39:39.225Z","innerViewport":"360x640","projects":{"at100":"none","at200percentZoom":"none"},"requirements":{"at100":"none","at200percentZoom":"none","at200percentZoomDarkTheme":"none","darkBodyBackground":"rgb(17, 24, 39)"}}
]
```

## What was exercised

- **Pages**: SignIn → Projects (project created and opened) → Requirements, through the real
  running application, signed in through the rendered form.
- **Themes**: light and dark, switched live; `--color-surface` resolved `#ffffff` ↔ `#111827` and
  the body background followed.
- **Viewport**: 360×640 CSS pixels (the FR-DS-040 minimum), measured in a true 360px layout
  viewport after the OS window manager refused a top-level resize.
- **Zoom**: 200% text zoom (root font-size 32px), light and dark.
- **Outcome**: no horizontal overflow in any condition — after `DEF-029-002` (488px → 384px →
  362px → none), whose discovery by this run is the run doing its job.

## Addendum — second run, 2026-08-22: the theme override (T913)

**Provenance**: same discipline as above — records emitted by an in-page driver against the
running application at `http://localhost:5175`, reproduced verbatim. This run exists because
`/speckit-converge` found that `design/theme.ts` was built and unit-tested while **nothing called
it**: the OS-default path is pure CSS, so the application rendered correctly with zero JavaScript
and the persistent override of `FR-DS-011` was unreachable code. `T913` wired it; this is the
evidence that the wiring is real, including the one thing jsdom cannot prove — survival of a
genuine page reload.

```json
[
{"step":"T913 run start — no stored override","at":"2026-08-22T00:57:43.334Z","url":"http://localhost:5175/","storedPreference":null,"dataThemeAttribute":null},
{"step":"theme control present in the composed application","at":"2026-08-22T00:57:47.221Z","ok":true,"tagName":"SELECT","label":"Theme","options":["(follow-system)=Follow system","light=Light","dark=Dark"],"onPage":"Projects"},
{"step":"user chose Dark via the control","at":"2026-08-22T00:57:48.222Z","dataThemeAttribute":"dark","storedPreference":"dark","resolved":{"--color-surface":"#111827","bodyBackground":"rgb(17, 24, 39)"}},
{"step":"AFTER A REAL PAGE RELOAD — the override survived (this is what jsdom cannot prove)","at":"2026-08-22T00:58:07.214Z","navigationType":"reload","storedPreference":"dark","dataThemeAttribute":"dark","controlShows":"dark","resolved":{"--color-surface":"#111827","bodyBackground":"rgb(17, 24, 39)"}},
{"step":"user chose Follow system — override cleared, OS back in charge","at":"2026-08-22T00:58:08.210Z","storedPreference":null,"dataThemeAttribute":null,"resolved":{"bodyBackground":"rgb(255, 255, 255)"}}
]
```

**What it establishes**: the control is reachable on every page of the composed application, a
choice applies immediately, it **persists across a real reload** (`navigationType: "reload"`, the
stored preference and the resolved token both surviving), and clearing it hands the theme back to
the operating system. `FR-DS-011` is now satisfied by a capability a user can actually reach,
rather than by a module that passed its tests.

## What this transcript does NOT claim

- Nothing here is contrast evidence — contrast is computed from token values in
  `tests/governance/design-tokens.spec.ts` (T872).
- Nothing here is the manual keyboard/screen-reader pass — that is `T885`, human work, recorded
  separately in `EPIC-029-manual-pass.md`.
