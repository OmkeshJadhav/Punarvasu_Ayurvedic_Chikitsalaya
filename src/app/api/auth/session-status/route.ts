import { apiSuccess } from "@/lib/api/response";
import { createRouteHandler } from "@/lib/api/route-handler";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Whether the caller has a session. One boolean, nothing else.
 *
 * ## Why this exists
 *
 * The public site is thirty statically prerendered pages, and that is a
 * deliberate result of Phases 03-05: no request-time data fetching, no
 * per-visitor rendering, fast first paint on a phone. Reading the session in
 * the public layout would make every one of those pages dynamic, which is a
 * real regression traded for a header label.
 *
 * `phase_06.md` section 38 nevertheless asks the public navigation to reflect
 * authenticated state. This endpoint is how the two are reconciled: the pages
 * stay static, and the header's account slot asks one question after
 * hydration.
 *
 * ## Why it is safe to answer
 *
 * The response is `{ authenticated: boolean }`. No id, no email, no name, no
 * role, no token. There is nothing in it to leak and nothing in it worth
 * forging, because nothing is authorized on the strength of it - it changes
 * which of two links the header draws (`phase_06.md` sections 26 and 39).
 *
 * The authoritative check is `requireUser()` inside the protected layout and
 * row-level security in the database. A client that lies to itself about this
 * value gets a differently-worded link and no access whatsoever.
 */
export const GET = createRouteHandler("auth.session_status", async () => {
  const user = await getCurrentUser();

  return apiSuccess(
    { authenticated: user !== null },
    {
      headers: {
        // Per-visitor, so no shared cache may keep it and no browser may
        // replay it after sign-out (`phase_06.md` section 74).
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
});
