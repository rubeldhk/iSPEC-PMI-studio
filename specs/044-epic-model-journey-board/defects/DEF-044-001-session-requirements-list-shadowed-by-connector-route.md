# DEF-044-001 — the session `GET /v1/projects/{id}/requirements` was shadowed by the connector's route

**Epic**: `EPIC-044` | **Raised**: 2026-09-05 | **Status**: CLOSED 2026-09-05

**Originating task**: `EPIC-043` `T1445` (the connector reads) · found while executing `T1572`
(the Epic routes through the composed application)
**Severity**: HIGH — every session read of a project's requirement register answered `401` in the
running application since `EPIC-043` landed; the Requirements screen could not load

## Expected

`GET /v1/projects/{id}/requirements` with a session cookie lists the project's requirements
(`EPIC-007` `T070`, `contracts/platform-api.md`); the same path with a bearer credential and
`?groupBy=epic` is the connector read `pmi.requirements.list` translates to (`EPIC-043`
`contracts/reads-api.md`). Both must answer.

## Actual

`ConnectorReadsController` (`@Controller('projects')`, guarded at class level) declares
`@Get(':projectId/requirements')`; `RequirementsController` (`@Controller()`) declares
`@Get('projects/:projectId/requirements')`. `ConnectorModule` is scanned before
`RequirementsModule`, so the connector's route registered first and matched every request to the
path; the class-level `ConnectorAuthGuard` refused the session cookie as
`invalid_connector_credential` (`401`). No integration test drove the session route through the
composed application — `EPIC-007`'s tests build the controller by hand and `EPIC-043`'s drive the
bearer path only — so the shadowing was invisible while every gate was green: the
`DEF-005-001` class (built, tested, called by nothing) in its route-collision form.

## Resolution

`T1573` applied the pattern `EPIC-042` used for `GET /v1/projects/{id}/constitution`
(`R-042-10`): one route, two callers. `RequirementsModule` is imported before `ConnectorModule` in
`backend/src/app.module.ts`, so the session controller owns the path; `RequirementsController.list`
dispatches a request carrying `Authorization: Bearer …` to the connector read — it runs
`ConnectorAuthGuard.authenticate` for `requirements.read` and answers `ProjectContextService.requirementsByEpic`
— resolved through `ModuleRef` at request time so the two modules keep their one-way dependency.
`backend/tests/integration/epics-api.spec.ts` (`T1572`) now drives the session route through the
composed application and `connector-reads.spec.ts` keeps driving the bearer route, so the collision
cannot return unseen.
