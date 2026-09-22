import { NextResponse } from "next/server";

import { APPOINTMENT_REPORT } from "@/config/analytics";
import {
  appointmentReportCsv,
  appointmentReportFilename,
} from "@/features/analytics/export";
import { getAppointmentReport } from "@/features/analytics/queries";
import { resolveRange } from "@/features/analytics/ranges";
import {
  REPORT_REQUEST_FIELDS,
  appointmentReportRequestSchema,
} from "@/features/analytics/validation";
import { createRouteHandler } from "@/lib/api/route-handler";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  internalError,
  unauthorizedError,
  validationError,
} from "@/lib/errors/app-error";

/**
 * The appointment operations report, as a CSV download.
 *
 * ## Why a route handler and not a server action
 *
 * A server action returns data to React; this has to return a **file**, with
 * a `Content-Type` and a `Content-Disposition` the browser acts on. A route
 * handler is the only thing in the App Router that can set those.
 *
 * Everything else about the request is treated exactly as a server action's
 * payload would be: authenticated here, authorized by
 * `getAppointmentReport`'s `reports.export` check, validated against a strict
 * schema, and bounded again by the database.
 *
 * ## `POST`, deliberately
 *
 * `phase_16.md` section 47 forbids a public download URL. This is not one —
 * it requires a session — but a `GET` download URL would still be
 * prefetchable, bookmarkable and pasteable into a chat, and a report of
 * clinic operations is a worse thing to have leaking around as a link than as
 * a file somebody deliberately created. A `POST` also means no browser or
 * proxy will speculatively fetch it.
 *
 * It is a real `<form method="post">`, so the download works with no
 * JavaScript at all.
 *
 * ## What it never accepts
 *
 * A column list, a format, a report id, a clinic id, an organization id, a
 * patient id, a limit or a sort. The report is defined once in
 * `config/analytics.ts` and there is exactly one of it, so section 101's
 * "change the reportId" has nothing to change and section 61's raw-query
 * endpoint has no parameter to become.
 *
 * **How that is enforced, precisely.** A form field not on
 * `REPORT_REQUEST_FIELDS` is never *read* — the loop below copies three named
 * fields and ignores the rest of the body, so an extra input on the form
 * reaches nothing. It is therefore dropped at that layer rather than
 * rejected, and a request carrying `columns=diagnosis` succeeds while having
 * no effect whatever.
 *
 * `strict()` is the *second* layer, and it protects the case the first one
 * cannot: an object assembled in code — a refactor that spreads a parsed
 * body, a future caller that builds the input itself. The third is the RPC's
 * fixed argument list, which has no such parameter at all.
 *
 * This distinction is written out because Phase 08 shipped a docblock
 * claiming `strict()` rejected an extra form field when the named-field read
 * meant it never saw one, and a comment that overstates a control is how
 * somebody later removes the control that is actually doing the work.
 *
 * ## What it returns
 *
 * Counts per clinic day, practitioner, appointment type and status. No
 * patient identifier, no note, no internal note, no clinical field — none of
 * them is in the RPC's return type, so none can reach the file however this
 * handler is called.
 *
 * ## Caching
 *
 * `private, no-store`, explicitly. A report of clinic operations must not be
 * held by a proxy, a CDN or the browser's back-forward cache.
 */
export const POST = createRouteHandler(
  "reports.appointments",
  async (request) => {
    const user = await getCurrentUser();
    if (!user) throw unauthorizedError();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw validationError(
        { form: ["We couldn't read that request. Please try again."] },
        {
          message: "We couldn't read that request. Please try again.",
          cause: new Error("Malformed multipart body on a report request."),
        },
      );
    }

    // Read field by field from a fixed list, so an input somebody added to
    // the DOM is never read at all. The schema's `strict()` is the second
    // layer, and the RPC's fixed argument list the third.
    const raw: Record<string, string> = {};
    for (const field of REPORT_REQUEST_FIELDS) {
      const value = formData.get(field);
      if (typeof value === "string" && value.length > 0) {
        raw[field] = value;
      }
    }

    const parsed = appointmentReportRequestSchema.safeParse(raw);
    if (!parsed.success) {
      throw validationError(
        {
          from: [
            "That reporting period isn't valid. Check the dates and try again.",
          ],
        },
        {
          message:
            "That reporting period isn't valid. Check the dates and try again.",
          cause: new Error("Report request failed validation."),
        },
      );
    }

    // The same four rules the database enforces, applied here so a bad range
    // is a clear message rather than a generic failure. The database checks
    // them again regardless.
    const resolved = resolveRange(parsed.data.from, parsed.data.to, "custom");
    if (resolved.status !== "ok") {
      throw validationError(
        {
          from: [
            "That reporting period isn't supported. Choose a period of up to one year.",
          ],
        },
        {
          message:
            "That reporting period isn't supported. Choose a period of up to one year.",
          cause: new Error(`Report range rejected: ${resolved.problem}`),
        },
      );
    }

    const result = await getAppointmentReport(
      resolved.range,
      parsed.data.practitionerId,
    );

    if (result.status !== "ready") {
      throw internalError({
        message: "We couldn't build that report. Please try again.",
        cause: new Error(`Report read returned ${result.status}.`),
      });
    }

    const csv = appointmentReportCsv(result.data);
    const filename = appointmentReportFilename(
      resolved.range.from,
      resolved.range.to,
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        // The filename is built from two validated ISO dates and a constant
        // slug, so it carries no character this header would have to escape
        // and nothing about a patient (section 46).
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-report": APPOINTMENT_REPORT.slug,
      },
    }) as NextResponse<string>;
  },
);
