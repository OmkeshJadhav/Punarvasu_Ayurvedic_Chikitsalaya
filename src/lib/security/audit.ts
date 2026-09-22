/**
 * The security audit trail.
 *
 * ## What this is for
 *
 * `phase_19.md` sections 89-91 ask for security-relevant events to be
 * capturable, and six phases deferred specific capabilities to it with the
 * same sentence each time: granting the capability would grant it *unaudited*.
 * Phase 12 said it about administrative clinical access, Phase 13 about
 * prescription reads, Phase 14 about document access, Phase 18 recorded that
 * the list had only grown.
 *
 * ## What it records
 *
 * Who reached what, when, and whether they were allowed to. Nothing else, and
 * the table has no column for anything else — no diagnosis, no medicine, no
 * title, no filename, no path, no search term, no free text at all beyond a
 * bounded correlation id. A reader learns that a practitioner opened a
 * patient's record at 14:32; they do not learn what it said.
 *
 * That is not a limitation to be worked around later. It is what lets the
 * trail be kept longer than the records it describes, read by whoever
 * investigates an incident, and shipped to an operations tool — none of which
 * would be acceptable if it carried clinical content.
 *
 * ## Which accesses are recorded
 *
 * **Privileged** ones: somebody reaching data that is not their own.
 *
 *   * a practitioner opening a clinical record, prescription or treatment plan
 *   * staff opening a patient's demographic record
 *   * anybody being handed a signed URL for a document
 *   * an administrator exporting a report
 *
 * A patient reading their own prescription is deliberately **not** recorded.
 * It is not privileged access, it happens constantly, and recording it would
 * bury the entries that matter under the ones that do not — which is how an
 * audit trail becomes something nobody reads.
 *
 * ## It never fails the operation
 *
 * Every function here is fire-and-forget and swallows its own errors, and the
 * database function does the same on its side. The caller has already been
 * authorized and the work has already happened; an audit write that could fail
 * a request would turn a logging problem into a clinical one — a practitioner
 * unable to open a record mid-consultation because an insert timed out.
 *
 * The structured log records the same operations independently, so an entry
 * lost here is not an event lost entirely.
 */
import "server-only";

import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AuditAction = Database["public"]["Enums"]["security_audit_action"];
type AuditResource = Database["public"]["Enums"]["security_audit_resource"];
type AuditOutcome = Database["public"]["Enums"]["security_audit_outcome"];

export interface SecurityAuditEntry {
  readonly action: AuditAction;
  readonly resourceType: AuditResource;
  readonly outcome: AuditOutcome;
  /** The record reached. Absent for a route-level denial. */
  readonly resourceId?: string | null;
  /**
   * Whose data this was, when that differs from which record was opened.
   *
   * It is what turns "show me everyone who reached this patient" into one
   * indexed query instead of a join per resource type.
   */
  readonly subjectPatientId?: string | null;
  /** The application's correlation id, when the call site has one. */
  readonly requestId?: string | null;
}

/**
 * Records one privileged access.
 *
 * Awaited by its callers rather than left dangling, because a floating promise
 * in a server component can be cut off when the render finishes — but the
 * awaited work is a single insert and it cannot throw.
 *
 * The actor is **not** a parameter. It is `auth.uid()`, resolved inside the
 * database, so an entry cannot be attributed to anybody but the caller.
 */
export async function recordSecurityAuditEvent(
  entry: SecurityAuditEntry,
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.rpc("record_security_audit_event", {
      p_action: entry.action,
      p_resource_type: entry.resourceType,
      p_outcome: entry.outcome,
      p_resource_id: entry.resourceId ?? null,
      p_subject_patient_id: entry.subjectPatientId ?? null,
      p_request_id: entry.requestId ?? null,
    });

    if (error) {
      // The action and the outcome, and nothing that identifies the subject.
      // A failed audit write must not become a second disclosure channel for
      // the thing it failed to record.
      logger.warn("security.audit_write_failed", {
        action: entry.action,
        outcome: entry.outcome,
      });
    }
  } catch {
    // Unreachable in practice - the RPC returns its failure rather than
    // throwing - and swallowed anyway, because the contract this module offers
    // its callers is that auditing cannot break them.
    logger.warn("security.audit_unavailable", { action: entry.action });
  }
}

/**
 * Records a refused request.
 *
 * Separate from {@link recordSecurityAuditEvent} only so the call sites read
 * as what they are. A run of these against one actor is the clearest signal in
 * the system that somebody is probing, and `phase_19.md` sections 156-157 ask
 * for exactly that to be watchable without building behavioural profiling.
 */
export async function recordAuthorizationDenied(
  context: {
    readonly resourceType?: AuditResource;
    readonly resourceId?: string | null;
  } = {},
): Promise<void> {
  const resourceType = context.resourceType ?? "route";

  await recordSecurityAuditEvent({
    action: "authorization.denied",
    resourceType,
    outcome: "denied",
    // A route-level denial names no resource, and the database refuses an
    // entry that claims to be about a route and a record at once.
    resourceId: resourceType === "route" ? null : (context.resourceId ?? null),
  });
}
