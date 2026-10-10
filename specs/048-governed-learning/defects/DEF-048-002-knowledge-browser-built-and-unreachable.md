# DEF-048-002 — the knowledge browser is built and reachable from nowhere

**Epic**: `EPIC-048` | **Raised**: 2026-10-10 | **Status**: OPEN — discharged by `T2387`

**Originating task**: `T2381` (`frontend/src/pages/KnowledgeBrowser.tsx`) · found by `EPIC-010`'s
`T200a` (`frontend/tests/unit/design/page-reachability.spec.ts`), which reports the page as imported by
nothing reachable from `src/main.tsx`
**Severity**: MEDIUM — the capability exists and is tested; a person cannot reach it in the running
application. This is the `DEF-005-001` / `DEF-010-001` class, and `T200a` is right to fail on it.
**Owner**: `EPIC-048`. **Discharge task**: `T2387` (route `/context/knowledge` as a `SUB_VIEWS` entry
and link it from the Context page), **⛔ blocked on `EPIC-038` merging** — the Context area is
`declared-not-delivered` on `main` (`frontend/src/shell/areas.ts`), so there is no page to host the
sub-view or link from.

## Expected

`FR-LRN-070`, `UX-0003`: approved knowledge is browsed in a view within `EPIC-038`'s Context area,
reachable from primary navigation.

## Actual

`KnowledgeBrowser` renders, filters and opens history (`T2380`, 9/9), and its API calls exist in
`ApiClient`. Nothing routes to it. `T200a` fails with exactly one unreachable page:
`pages/KnowledgeBrowser.tsx`.

## Why it is not allow-listed or moved

`T200a`'s header forbids both: *"do not allow-list … do not delete it to get a green run. It goes green
when each page is either routed or removed."* Moving the file out of `src/pages/` to escape the scan
would be the same silencing by other means. Routing it under a Context area that `main` has not
delivered would be `T2387` done against a host that does not exist yet — the reason that task is
blocked.

## Condition to discharge

`EPIC-038` merged (merge-order step 3, with `A-038-1`), then `T2386`–`T2387`. `T200a` then passes with
no change to it.

## Exit-gate effect

Open defects block the Epic's exit (spec *Epic Exit Criteria*). This one closes in the same rebase that
brings the Context area in, before `EPIC-048` can merge (merge-order step 5).
