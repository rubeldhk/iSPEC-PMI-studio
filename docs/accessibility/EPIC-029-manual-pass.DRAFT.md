# DRAFT — EPIC-029 manual keyboard and screen-reader pass (T885)

> ## ⛔ THIS IS NOT THE RECORD. IT IS NOT EVIDENCE OF ANYTHING BEING HEARD.
>
> `T885` requires a **person** to walk the product with a **screen reader** and judge whether
> focus order makes sense and whether each announcement is *meaningful*. An agent cannot hear a
> screen reader, and writing a record that claimed otherwise would fabricate the exact evidence
> `T884` exists to test for — the offence `G-28-02` rejected `T709`'s first attempt for.
>
> So this file:
>
> - is deliberately named `…-manual-pass.DRAFT.md`, **not** `EPIC-029-manual-pass.md`, so
>   `tests/governance/accessibility-record.spec.ts` (T884) keeps failing until a human does the
>   work — the check is doing its job while this file exists;
> - contains, in Part 1, the half that **is** machine-observable, genuinely recorded by real
>   keypresses against the running application on 2026-08-22;
> - leaves Part 2 blank, because only you can fill it.
>
> **`T885` and `T884` are both still open. Nothing here ticks them.**

---

## Part 1 — recorded by machine (real keypresses, `http://localhost:5176`, 2026-08-22)

**Method**: Chrome 151 driven over CDP against the restyled worktree build. `Tab` and `shift+Tab`
were real key events; each focus move was captured by a `focusin` listener recording the focused
element, its computed accessible name (`aria-labelledby` → `aria-label` → associated `<label>` →
text content), whether it matches `:focus-visible`, and its resolved outline. **Honest caveat**: in
several steps focus was placed with a pointer click because the automation harness would otherwise
drop keystrokes; the tab-order enumerations below were keyboard-driven throughout, but this run is
**not** a no-mouse walk. That, too, is yours to perform.

### Focus order — sign-in page (from the top of the document)

```text
1. select#theme-control        — "Theme"    — :focus-visible ✓ — outline: solid 2px rgb(29,78,216)
2. input[type=email]#sign-in-email    — "Email"    — :focus-visible ✓ — outline: solid 2px rgb(29,78,216)
3. input[type=password]#sign-in-password — "Password" — :focus-visible ✓ — outline: solid 2px rgb(29,78,216)
4. button[type=submit]         — "Sign in"  — :focus-visible ✓ — outline: solid 2px rgb(29,78,216)
   (a 5th Tab left the page — the cycle closes, no keyboard trap)
```

### Focus order — projects page

```text
1. input#project-name — "Project name" — :focus-visible ✓
2. button[submit]     — "Create"       — :focus-visible ✓
3. button             — "<project name>" — :focus-visible ✓
4. select#theme-control — "Theme"      — :focus-visible ✓
   (wraps cleanly back to 1)
```

### Focus order — project surface (requirement capture)

```text
 1. button                        — "Back to projects"
 2. button                        — "Archive"
 3. input#project-rename          — "Name"
 4. button[submit]                — "Rename"
 5. select#engine-selector        — "Engine"
 6. button                        — "Traceability"
 7. select#requirements-type      — "Type"          ← register filter
 8. select#requirements-priority  — "Priority"      ← register filter
 9. select#requirements-status    — "Status"        ← register filter
10. textarea#requirement-description — "Description"
11. select#requirement-type       — "Type"          ← editor field (same name as 7)
12. select#requirement-priority   — "Priority"      ← editor field (same name as 8)
13. button[submit]                — "Save"
```

Every one of the 13 stops matched `:focus-visible` and carried a non-empty accessible name.

### What the run established

- **Every interactive element is reachable and every one shows a visible focus indicator** — the
  token-derived `2px solid #1d4ed8` outline (`--color-focus`), on all three surfaces. This is the
  machine-checkable half of `US1/AC1`.
- **The journey completes from the keyboard**: sign-in submitted with `Enter`, a project created
  with `Enter`, and a requirement captured and saved — confirmed against the API
  (`REQ-001`, *"The system shall record a keyboard-only accessibility pass."*). This is the
  machine-checkable half of `SC-DS-002`.
- **No keyboard trap** on any surface; every cycle closes.
- **The Button keeps its label while loading** — the sign-in control read `Signing in…` with its
  spinner, never a bare spinner (`contracts/components.md` row 1).

### What the run found wrong

- `DEF-029-003` — the shell's own **Traceability** and **Back to project** buttons carry no
  design-system styling; a delivered page mixes two visual languages.
- `DEF-029-004` — **"Type" and "Priority" each appear twice** in one tab cycle with identical
  accessible names (register filter vs editor field). Machine-observable; whether it is *confusing*
  is a judgement for Part 2.
- `DEF-029-005` — a saved requirement does not appear until a filter changes, so the register shows
  *"No requirements match"* immediately after the user added one that does.

---

## Part 2 — TO BE COMPLETED BY A HUMAN (this is the actual `T885`)

Fill every field. Nothing below may be filled by an agent.

```text
Screen reader:      ____________________   (e.g. NVDA, JAWS, VoiceOver, Narrator)
Version:            ____________________
Browser + version:  ____________________
Operating system:   ____________________
Date:               ____________________
Performed by:       ____________________
Mouse used at any point?  yes / no        (T885 requires: no)
```

### Journey 1 — sign in

- [ ] Walked with keyboard only, no mouse
- [ ] Focus order made sense (record anything surprising): ______________________
- [ ] Each control announced with a name that told you what it was: ______________________
- [ ] The error, when sign-in failed, was **announced** and said which field and what to fix
      (the page renders it in a `role="alert"`; the question is whether you *heard* it): ______

### Journey 2 — create a project

- [ ] Walked with keyboard only
- [ ] Focus order made sense: ______________________
- [ ] The new project's arrival in the list was discoverable without sight: ______________________

### Journey 3 — capture a requirement

- [ ] Walked with keyboard only
- [ ] Focus order made sense: ______________________
- [ ] **`DEF-029-004` judgement**: tabbing reaches "Type" and "Priority" twice — once as a filter,
      once as an editor field. Was that ambiguous when heard? ______________________
      If yes, which wording would you have wanted? ______________________
- [ ] **`DEF-029-005` judgement**: after saving, the register still announced "No requirements
      match". How badly did that mislead? ______________________

### Theme control (new, `T913`)

- [ ] Reachable and operable by keyboard, announced meaningfully: ______________________

### Overall

- [ ] Could you complete sign-in → create project → capture requirement using only a keyboard and a
      screen reader? **yes / no**
- [ ] Anything an automated check would never have caught: ______________________

---

## When Part 2 is complete

1. Save this file as **`docs/accessibility/EPIC-029-manual-pass.md`** (drop `.DRAFT`), keeping
   Part 1 — the machine evidence belongs with the human evidence, and the record should show which
   is which.
2. Run the check:

   ```bash
   pnpm vitest run --project governance tests/governance/accessibility-record.spec.ts
   ```

   It requires a named screen reader, a version containing a digit, at least one journey, and a
   date. A file saying only "passed" fails by design (`SC-DS-008`).
3. Tick `T884` and `T885` in `specs/029-design-system/tasks.md` — **only then**.
4. Delete this draft, or leave it; the check ignores it either way.
