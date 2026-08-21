/**
 * T274's code half — the twelve reviewing and authoring roles (FR-ENH-023).
 *
 * The names are the source document's "Recommended AI Agents" roster,
 * verbatim, kebab-cased. Each declares what it is accountable for and the
 * artifact types it may act on; acting outside them is refused BY NAME
 * (FR-ENH-024's attribution depends on roles meaning something).
 *
 * Framework-free (PC-1). The database seed (T274) mirrors this list; the
 * catalogue here is what the gate services consult.
 */
import { ValidationFailedError } from '../../core/errors.js';

export interface ReviewRole {
  name: string;
  responsibility: string;
  permittedArtifactTypes: string[];
}

const SPEC_AND_REQ = ['specification', 'requirement'];
const SPEC_ONLY = ['specification'];

export const REVIEW_ROLES: readonly ReviewRole[] = [
  {
    name: 'requirements-analyst',
    responsibility: 'Reviews requirements and specifications for completeness, testability, and ambiguity.',
    permittedArtifactTypes: SPEC_AND_REQ,
  },
  {
    name: 'business-analyst',
    responsibility: 'Reviews business rules, value alignment, and stakeholder impact.',
    permittedArtifactTypes: SPEC_AND_REQ,
  },
  {
    name: 'solution-architect',
    responsibility: 'Reviews architectural fit, boundaries, and technology-stack conformance.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'ux-designer',
    responsibility: 'Reviews user-facing flows against UI standards and accessibility expectations.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'planning-agent',
    responsibility: 'Reviews decomposition, sequencing, and dependency realism.',
    permittedArtifactTypes: ['specification', 'task'],
  },
  {
    name: 'developer-agent',
    responsibility: 'Authors and reviews implementation-facing content for feasibility.',
    permittedArtifactTypes: ['specification', 'task'],
  },
  {
    name: 'qa-agent',
    responsibility: 'Reviews acceptance criteria, test scenarios, and verifiability.',
    permittedArtifactTypes: ['specification', 'task'],
  },
  {
    name: 'security-reviewer',
    responsibility: 'Reviews specifications for security concerns against the security steering subject.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'performance-reviewer',
    responsibility: 'Reviews scale assumptions and performance-sensitive designs.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'documentation-agent',
    responsibility: 'Reviews structure, clarity, and conformance to the documentation standard.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'release-manager',
    responsibility: 'Reviews release readiness, baselining, and promotion criteria.',
    permittedArtifactTypes: SPEC_ONLY,
  },
  {
    name: 'operations-advisor',
    responsibility: 'Reviews operability, observability, and run-time concerns.',
    permittedArtifactTypes: SPEC_ONLY,
  },
];

const BY_NAME = new Map(REVIEW_ROLES.map((role) => [role.name, role]));

export function roleByName(name: string): ReviewRole {
  const role = BY_NAME.get(name);
  if (!role) {
    throw new ValidationFailedError(
      `Unknown reviewing role "${name}". The roster is: ${REVIEW_ROLES.map((r) => r.name).join(', ')}.`,
    );
  }
  return role;
}

export function assertRoleMayActOn(name: string, artifactType: string): void {
  const role = roleByName(name);
  if (!role.permittedArtifactTypes.includes(artifactType)) {
    throw new ValidationFailedError(
      `Role "${name}" may not act on "${artifactType}" — its permitted artifact types are: ` +
        `${role.permittedArtifactTypes.join(', ')}.`,
    );
  }
}
