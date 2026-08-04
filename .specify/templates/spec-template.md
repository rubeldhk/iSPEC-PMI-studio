# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Epic**: `[EPIC-###]` — [Epic name]

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## SRS Traceability *(mandatory — Constitution II)*

<!--
  Every requirement below MUST trace to a document in SRS/. List the sources here.
  Requirements with no SRS source MUST be listed under Assumptions and flagged for
  SRS back-fill. Where spec and SRS disagree, the SRS wins.
-->

| Source | Section | Covers |
|--------|---------|--------|
| `SRS/[document]` | [§ / heading] | [FR-00X, FR-00Y] |

**Requirements not yet covered by SRS**: [none | list + back-fill owner]

## Principle Conformance & Deferrals *(mandatory — PMI-DOC-003, decision D-6)*

<!--
  PMI-DOC-003 principles bind the PROGRAMME, not each Epic individually (decision D-6).
  Every Epic MUST therefore declare its position on all twenty. A deferral is a debt with a
  named owner, reviewed at the Epic's convergence gate — not permission to skip.
  Status: Satisfied | Partial | Deferred | Not applicable.
-->

| ID | Principle | Status | Evidence, or reason for deferral + where it lands |
|----|-----------|--------|---------------------------------------------------|
| PP-001 | Specification First, AI Second | | |
| PP-002 | Single Source of Truth | | |
| PP-003 | Human-in-the-Loop | | |
| PP-004 | End-to-End Traceability | | |
| PP-005 | Modular Architecture | | |
| PP-006 | Engine Independence | | |
| PP-007 | API & MCP First | | |
| PP-008 | Security by Design | | |
| PP-009 | Quality by Design | | |
| PP-010 | Observability by Default | | |
| PP-011 | Documentation as Code | | |
| PP-012 | Everything Versioned | | |
| PP-013 | Knowledge-Driven Engineering | | |
| PP-014 | Configuration over Customization | | |
| PP-015 | Open Standards | | |
| PP-016 | Explainable AI | | |
| PP-017 | Cost-Aware AI | | |
| PP-018 | Scalability First | | |
| PP-019 | Continuous Improvement (DORA/SPACE) | | |
| PP-020 | Customer Value | | |

**Deferral count**: [n] — each carries an owner and a discharging module or phase.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
- [Any requirement above with no SRS source — restate it here and name the back-fill owner]

## Epic Exit Criteria *(mandatory — Constitution IV, V, VI, IX)*

This Epic may be declared complete and promoted out of `local` only when ALL hold:

- [ ] Every implementation task has a passing unit test (Constitution V)
- [ ] `/speckit-converge` reports no unbuilt work, or all remainder is deferred to a named Epic
- [ ] `specs/[epic-id]/defects/` contains no open defect records
- [ ] Promotion follows `local → dev → stage → prod` with no skipped environment
- [ ] A closing report was published: work completed, work deferred, and the recommended next
      task named as a concrete Spec Kit command (Constitution IX)
