/** EPIC-046 `T1690` — injection tokens for the task sync (data-model.md §3–§5). */
export const TASK_SYNC_STORE = Symbol('TASK_SYNC_STORE');
/** EPIC-012's progress aggregate, reached through a narrow port so there is one derivation (`R-046-7`). */
export const TASK_PROGRESS_PORT = Symbol('TASK_PROGRESS_PORT');
