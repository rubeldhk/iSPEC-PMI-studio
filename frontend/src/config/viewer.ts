/**
 * `T1647` (EPIC-045, `FR-ART-023`) — the one place the viewer's size limit is
 * stated.
 *
 * Above this, a synced file is shown as **raw text with the reason** and no
 * *render anyway* control. Two megabytes is well above any artifact this
 * platform's own commands produce (the largest `tasks.md` in this repository is
 * under 40 KiB) and well below what makes a browser tab unresponsive parsing
 * markdown into React elements.
 *
 * It is a constant rather than configuration because it is a property of the
 * BROWSER, not of the deployment: an operator lowering it would not make any
 * machine faster, and raising it would only move the failure into the reader's
 * tab. The platform-side limits that ARE configuration — how large a file may
 * be *stored*, and how many — are `PMI_ARTIFACT_MAX_BYTES` and
 * `PMI_ARTIFACT_MAX_FILES` on the API.
 */
export const RENDER_LIMIT_BYTES = 2 * 1024 * 1024;
