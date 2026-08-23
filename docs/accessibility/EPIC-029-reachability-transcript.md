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

---

# Phase 9 re-verification — 2026-08-23 (T927)

**Why there is a second run.** Phase 9 (prototype parity) changed the visual layer the run above
measured: the page now sits on `--color-canvas` rather than on `--color-surface`, the shell gained
a sticky top bar and a bounded content column, and Table, StatusPill, PageHeader, Button, Modal and
Navigation all changed shape. The 2026-08-21 records above therefore describe a build that no
longer exists — they record `"bodyBackground":"rgb(255, 255, 255)"`, which is now
`rgb(246, 247, 249)` in light and `rgb(11, 17, 32)` in dark. **Evidence does not survive the thing
it was evidence of**, so Tier 2 was re-driven.

**Provenance**: emitted by an in-page driver executing against the running application at
`http://localhost:5173` (this worktree's Vite dev server, proxying `/v1` to the backend started
from `backend/src/main.ts` on `:3000`, against the local Postgres and Valkey containers) on
2026-08-23. The driver read `getComputedStyle` and `scrollWidth` from the live document and
appended one JSON record per step. Records are reproduced **verbatim**.

```json
[
{"step":"SignIn page in the Phase 9 shell, desktop","at":"2026-08-23T20:17:18.379Z","layoutViewport":"1280x800","rootFontSize":"16px","theme":"(follows OS)","resolved":{"--color-canvas":"#0b1120","--color-surface":"#111827","--color-accent-subtle":"#1e2a4a","bodyBackground":"rgb(11, 17, 32)"},"horizontalOverflow":"none","widerThanViewport":[],"shell":{"topbar":true,"topbarText":"PMI Studio / Sign inThemeFollow systemLightDark","topbarPosition":"sticky","topbarBackground":"rgb(17, 24, 39)","contentColumn":true},"signInButton":{"className":"ds-button ds-button--primary","background":"rgb(96, 165, 250)"}},
{"step":"theme switched: light","at":"2026-08-23T20:17:19.152Z","layoutViewport":"1280x800","rootFontSize":"16px","theme":"light","resolved":{"--color-canvas":"#f6f7f9","--color-surface":"#ffffff","--color-accent-subtle":"#e9edff","bodyBackground":"rgb(246, 247, 249)"},"horizontalOverflow":"none","widerThanViewport":[]},
{"step":"theme switched: dark","at":"2026-08-23T20:17:20.142Z","layoutViewport":"1280x800","rootFontSize":"16px","theme":"dark","resolved":{"--color-canvas":"#0b1120","--color-surface":"#111827","--color-accent-subtle":"#1e2a4a","bodyBackground":"rgb(11, 17, 32)"},"horizontalOverflow":"none","widerThanViewport":[]},
{"step":"SignIn at 360x640, 100% text, light theme","at":"2026-08-23T20:17:44.143Z","layoutViewport":"360x640","rootFontSize":"16px","theme":"light","bodyBackground":"rgb(246, 247, 249)","canvas":"#f6f7f9","horizontalOverflow":"none","widerThanViewport":[]},
{"step":"SignIn at 360x640, 200% text zoom, light theme","at":"2026-08-23T20:17:45.179Z","layoutViewport":"360x640","rootFontSize":"32px","theme":"light","bodyBackground":"rgb(246, 247, 249)","canvas":"#f6f7f9","horizontalOverflow":"none","widerThanViewport":[]},
{"step":"SignIn at 360x640, 100% text, dark theme","at":"2026-08-23T20:17:46.151Z","layoutViewport":"360x640","rootFontSize":"16px","theme":"dark","bodyBackground":"rgb(11, 17, 32)","canvas":"#0b1120","horizontalOverflow":"none","widerThanViewport":[]},
{"step":"SignIn at 360x640, 200% text zoom, dark theme","at":"2026-08-23T20:17:47.148Z","layoutViewport":"360x640","rootFontSize":"32px","theme":"dark","bodyBackground":"rgb(11, 17, 32)","canvas":"#0b1120","horizontalOverflow":"none","widerThanViewport":[]},
{"step":"conditions restored","at":"2026-08-23T20:17:48.145Z","layoutViewport":"360x640","rootFontSize":"16px","theme":"dark","bodyBackground":"rgb(11, 17, 32)","canvas":"#0b1120","horizontalOverflow":"none","widerThanViewport":[]}
]
```

## What this run established

- **The Phase 9 shell is real in the running application**: a `sticky` `.ds-topbar` reading
  *"PMI Studio / Sign in"* with the theme control in it, above a `.ds-content` column.
- **The canvas token reaches the document and the body follows it** — `#f6f7f9` in light,
  `#0b1120` in dark, matching `tokens.css` and `themes.css` exactly. This is the value the
  2026-08-21 run recorded as `rgb(255, 255, 255)`, and the reason that run needed replacing.
- **No horizontal overflow in any condition** — 1280×800 and 360×640, at 100% and 200% text
  zoom, in both themes. `widerThanViewport` is empty in every record, so no single element is
  the culprit either.

## What this run did NOT establish — and who must

**The authenticated half was not re-driven.** Reaching Projects and Requirements requires signing
in, and the agent performing this run does not enter credentials into a running application. The
2026-08-21 records above remain the only Tier 2 evidence for those two pages, and they now
**predate the Table tools bar, the tinted StatusPill and the PageHeader description that those very
pages render**.

This is tracked as **`DEF-029-007`** and **`T927`**, and it belongs to the same human session as
`T885`: whoever performs the manual keyboard and screen-reader pass is already signed in on the
restyled build, and re-driving the two authenticated pages at 360×640 and 200% zoom in both themes
costs them a few minutes on top of work they are already doing.

Until then, **Constitution XI Tier 2 is satisfied for SignIn and the shell, and stale for Projects
and Requirements.** `T901a` may not be re-confirmed on the strength of this run alone.
