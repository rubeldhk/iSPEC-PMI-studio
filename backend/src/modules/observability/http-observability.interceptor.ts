/**
 * T663 — the API is observable per request.
 *
 * DEF-001-002: `T164` promised metrics for "API requests and generation jobs".
 * `requestFinished` and `correlationFor` had zero production call sites,
 * because `main.ts` installed the bundle at startup and nothing ran at the
 * point where a route, a status and a duration are known.
 *
 * **Why this lives in `modules/` and not `core/`.** PC-1 keeps business logic
 * callable without HTTP, and the lint rule enforcing it forbids
 * `backend/src/core/**` from importing `@nestjs/common`. An interceptor *is*
 * transport — it exists to observe HTTP — so it belongs on the transport side
 * of that line. `modules/audit/audit.interceptor.ts` sits in `modules/` for the
 * mirror-image reason: it is deliberately NOT a Nest interceptor, so it can be
 * used without one.
 *
 * The bundle is injected rather than constructed here, so the same instance
 * serves the startup record and every request, and so this class is testable
 * with a fake `ExecutionContext` and no Nest container.
 */
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { CORRELATION_FIELD, type Observability } from '@pmi/observability';

/** The shape this interceptor needs from a request. Not Express-specific. */
interface ObservedRequest {
  headers?: Record<string, unknown>;
  route?: { path?: string };
  url?: string;
  method?: string;
  [CORRELATION_FIELD]?: string;
}

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly observability: Observability) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<ObservedRequest>();
    const response = http.getResponse<{ statusCode?: number }>();

    // Adopt the caller's identifier when it is well-formed, mint one otherwise.
    // `correlationFor` validates rather than trusts: an unvalidated header is an
    // injection point into every log line and trace the request touches.
    const correlationId = this.observability.correlationFor(request.headers ?? {});

    // Downstream handlers read it from here, so one request has exactly one id
    // and it is the same one this interceptor reports (PC-3).
    request[CORRELATION_FIELD] = correlationId;

    const startedAt = Date.now();

    /**
     * The templated route, never the concrete path.
     *
     * `/v1/projects/:id` is one metric series; `/v1/projects/<uuid>` is one
     * series per row in the table. Falling back to `url` is a last resort and
     * is why `route.path` is preferred wherever the framework supplies it.
     */
    const route = request.route?.path ?? request.url ?? 'unknown';

    const finish = (): void => {
      const durationMs = Date.now() - startedAt;
      const status = response?.statusCode ?? 0;

      this.observability.metrics.requestFinished({ route, status, durationMs });

      this.observability
        .loggerFor({ workspaceId: 'platform', actorId: null, correlationId })
        .log(status >= 500 ? 'error' : 'info', 'http.request', {
          route,
          method: request.method ?? 'UNKNOWN',
          status,
          durationMs,
        });
    };

    // Both arms, deliberately. The requests worth measuring most are the ones
    // that failed, and an interceptor that only reports success produces a
    // latency distribution with the slow half missing.
    return next.handle().pipe(tap({ next: finish, error: finish }));
  }
}
