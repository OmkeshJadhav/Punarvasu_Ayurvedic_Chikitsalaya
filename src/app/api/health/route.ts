/**
 * Liveness endpoint.
 *
 * Answers one question - is this application instance serving requests - and
 * deliberately nothing else. It reports no version, environment, dependency
 * status or configuration, because an unauthenticated endpoint is a
 * reconnaissance surface.
 *
 * It intentionally does not check the database. A dependency probe belongs on
 * a separate, protected readiness endpoint; failing liveness on a database
 * blip would take healthy instances out of rotation.
 */
import { createRouteHandler } from "@/lib/api/route-handler";
import { apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export const GET = createRouteHandler(
  "health",
  async (_request, { requestId }) =>
    apiSuccess({ status: "ok" as const }, { requestId }),
);
