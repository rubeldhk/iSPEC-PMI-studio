---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Epic**: `[EPIC-###]`

**Input**: Design documents from `/specs/[epic-id]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: MANDATORY (Constitution V). Every task that produces or changes application code MUST
have at least one accompanying unit-test task. Unit tests are written FIRST and MUST fail before
the implementing code is written. A task is not complete until its tests pass. Tests are never
optional in this project.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Before starting**: sync the repository from GitHub, and confirm no other Claude session is
active on this checkout (if one is, work in a separate clone). Label the session with this Epic —
`EPIC-### <short name>` (Constitution VIII). See Constitution §Repository & Environment Governance.

**Before finishing**: close with a report — what was done (artifacts by path, plus anything in
scope that was not done and why) and the recommended next task as a concrete Spec Kit command
(Constitution IX).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup database schema and migrations framework
- [ ] T005 [P] Implement authentication/authorization framework
- [ ] T006 [P] Setup API routing and middleware structure
- [ ] T007 Create base models/entities that all stories depend on
- [ ] T008 Configure error handling and logging infrastructure
- [ ] T009 Setup environment configuration management

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (MANDATORY - Constitution V) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Unit tests for [Entity1]/[Service] in tests/unit/test_[name].py
- [ ] T011 [P] [US1] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T012 [P] [US1] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 1

Each task below is complete only when its paired unit test passes.

- [ ] T013 [P] [US1] Create [Entity1] model in src/models/[entity1].py (unit test: T010)
- [ ] T014 [P] [US1] Create [Entity2] model in src/models/[entity2].py (unit test: T010)
- [ ] T015 [US1] Implement [Service] in src/services/[service].py (depends on T013, T014)
- [ ] T016 [US1] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T017 [US1] Add validation and error handling
- [ ] T018 [US1] Add logging for user story 1 operations

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (MANDATORY - Constitution V) ⚠️

- [ ] T019 [P] [US2] Unit tests for [Entity]/[Service] in tests/unit/test_[name].py
- [ ] T020 [P] [US2] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T021 [P] [US2] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 2

- [ ] T022 [P] [US2] Create [Entity] model in src/models/[entity].py (unit test: T019)
- [ ] T023 [US2] Implement [Service] in src/services/[service].py (unit test: T019)
- [ ] T024 [US2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T025 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (MANDATORY - Constitution V) ⚠️

- [ ] T026 [P] [US3] Unit tests for [Entity]/[Service] in tests/unit/test_[name].py
- [ ] T027 [P] [US3] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T028 [P] [US3] Integration test for [user journey] in tests/integration/test_[name].py

### Implementation for User Story 3

- [ ] T029 [P] [US3] Create [Entity] model in src/models/[entity].py (unit test: T026)
- [ ] T030 [US3] Implement [Service] in src/services/[service].py (unit test: T026)
- [ ] T031 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Fill remaining unit-test gaps in tests/unit/ (Constitution V)
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Phase Z: Epic Closure (MANDATORY - Constitution IV, VI, VII, IX)

**Purpose**: Gate the Epic before it may be promoted out of `local`

- [ ] TXXX Confirm every implementation task has a passing unit test
- [ ] TXXX Run `/speckit-converge`; append and complete any remaining unbuilt work
- [ ] TXXX Triage `specs/[epic-id]/defects/`; every record closed or deferred to a named Epic
- [ ] TXXX Re-run full test suite green after defect fixes
- [ ] TXXX Promote `local → dev` (then dev → stage → prod; no environment skipped)
- [ ] TXXX Publish the Epic closing report: work completed, work deferred, and the recommended
      next Epic/command (Constitution IX)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and MUST FAIL before implementation (mandatory — Constitution V)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (mandatory, written first):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never edit code outside a Spec Kit command (Constitution I) — defects become new tasks, not
  direct patches (Constitution VI)
- Every command run ends with a closing report: what was done + recommended next task
  (Constitution IX); unrun tests are never reported as passing
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
