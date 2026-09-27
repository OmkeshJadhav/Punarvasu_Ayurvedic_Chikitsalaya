import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";

import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { AnalyticsTable } from "@/components/analytics/analytics-table";
import {
  DashboardCard,
  InitialsAvatar,
} from "@/components/analytics/dashboard/dashboard-card";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  formatClinicDateShort,
  formatClinicTime,
} from "@/features/appointments/time";
import { REGISTER_COPY } from "@/features/clinic-registers/content";
import {
  pageCount,
  visiblePages,
} from "@/features/clinic-registers/pagination";
import type {
  ActivityEntry,
  AppointmentRegisterRow,
  PatientRegisterRow,
  RegisterPage,
  RegisterResult,
} from "@/features/clinic-registers/types";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * The clinic registers: the dashboard's patient-level detail.
 *
 * ## Named, minimal, audited — and it says so
 *
 * These are the only panels on the dashboard that show a patient's name.
 * Each row holds a name and operational facts about an appointment; there is
 * no column for a phone number, a note or anything clinical, because the
 * database functions return none (`features/clinic-registers/types.ts`).
 * Every card ends with the sentence that tells the administrator their view
 * was recorded, because that is part of what makes showing it acceptable.
 *
 * ## Paging is links
 *
 * A page number says nothing about anybody, so it can live in the URL
 * alongside the period — shareable, bookmarkable, correct under the back
 * button, and working before hydration.
 */

/** "Tue 30 Sep" and "10:42 am" for an instant, in the clinic's timezone. */
function clinicMoment(
  iso: string,
): { readonly day: string; readonly time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  return {
    day: formatClinicDateShort(instant),
    time: formatClinicTime(instant),
  };
}

function AuditNote() {
  return (
    <p className="text-caption text-muted-foreground mt-4 flex gap-2 font-sans">
      <ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{REGISTER_COPY.auditNote}</span>
    </p>
  );
}

function PersonCell({
  name,
  badge,
}: {
  readonly name: string;
  readonly badge?: string | undefined;
}) {
  return (
    <span className="flex items-center gap-3">
      <InitialsAvatar name={name} />
      <span className="text-foreground font-medium whitespace-nowrap">
        {name}
      </span>
      {badge ? <Badge tone="primary">{badge}</Badge> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                           */
/* ------------------------------------------------------------------ */

const pageLinkClass = cn(
  "text-body-sm inline-flex size-11 items-center justify-center rounded-md border font-sans font-medium tabular-nums",
  MOTION_MICRO,
  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
);

/**
 * "Showing 9–16 of 43", then previous, numbered pages and next.
 *
 * The current page is `aria-current="page"` and filled, so it is not marked
 * by colour alone. A control with nowhere to go is rendered as plain,
 * non-interactive text rather than a disabled link, which is not a thing.
 */
export function RegisterPagination({
  page,
  pageSize,
  total,
  hrefFor,
  label,
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hrefFor: (page: number) => string;
  /** Names the navigation, e.g. "Appointment register pages". */
  readonly label: string;
}) {
  const count = pageCount(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="border-border mt-1 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-caption text-muted-foreground font-sans">
        {REGISTER_COPY.pagination.showing(from, to, total)}
      </p>

      {count > 1 ? (
        <nav aria-label={label}>
          <ul className="flex flex-wrap items-center gap-1.5">
            <li>
              {page > 1 ? (
                <Link
                  href={hrefFor(page - 1)}
                  aria-label={REGISTER_COPY.pagination.previous}
                  className={cn(
                    pageLinkClass,
                    "border-border text-foreground hover:bg-accent",
                  )}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </li>
            {visiblePages(page, count).map((item, index) =>
              item === null ? (
                <li
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="text-muted-foreground px-1 font-sans"
                >
                  …
                </li>
              ) : (
                <li key={item}>
                  <Link
                    href={hrefFor(item)}
                    aria-label={REGISTER_COPY.pagination.pageOfLabel(item)}
                    aria-current={item === page ? "page" : undefined}
                    className={cn(
                      pageLinkClass,
                      item === page
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-accent",
                    )}
                  >
                    {item}
                  </Link>
                </li>
              ),
            )}
            <li>
              {page < count ? (
                <Link
                  href={hrefFor(page + 1)}
                  aria-label={REGISTER_COPY.pagination.next}
                  className={cn(
                    pageLinkClass,
                    "border-border text-foreground hover:bg-accent",
                  )}
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/**
 * A page past the end — a stale bookmark after the period changed shape.
 * Said plainly, with the way back, rather than as an empty register.
 */
function BeyondEnd({ href }: { readonly href: string }) {
  return (
    <p className="text-body-sm text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center font-sans">
      {REGISTER_COPY.pagination.beyondEnd}{" "}
      <Link
        href={href}
        className="text-primary focus-visible:outline-ring rounded-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {REGISTER_COPY.pagination.firstPage}
      </Link>
    </p>
  );
}

function isPastEnd<Row>(page: RegisterPage<Row>): boolean {
  return page.rows.length === 0 && page.page > 1;
}

/* ------------------------------------------------------------------ */
/* Appointment register                                                 */
/* ------------------------------------------------------------------ */

export function AppointmentRegisterCard({
  titleId,
  register,
  hrefFor,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly register: RegisterResult<RegisterPage<AppointmentRegisterRow>>;
  readonly hrefFor: (page: number) => string;
  readonly retryHref: string;
  readonly className?: string;
}) {
  const copy = REGISTER_COPY.appointments;

  return (
    <DashboardCard
      titleId={titleId}
      title={copy.heading}
      description={copy.description}
      className={cn("scroll-mt-6", className)}
    >
      <AnalyticsPanel
        result={register}
        retryHref={retryHref}
        isEmpty={(page) => page.total === 0 && page.page === 1}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
      >
        {(page) =>
          isPastEnd(page) ? (
            <BeyondEnd href={hrefFor(1)} />
          ) : (
            <>
              <AnalyticsTable<AppointmentRegisterRow>
                embedded
                caption={copy.caption}
                rows={page.rows}
                rowKey={(row) => row.appointmentId}
                columns={[
                  {
                    header: copy.dateHeader,
                    cell: (row) => {
                      const moment = clinicMoment(row.startsAt);
                      return moment ? (
                        <span className="flex flex-col whitespace-nowrap">
                          <span className="text-foreground font-medium">
                            {moment.day}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {moment.time}
                          </span>
                        </span>
                      ) : (
                        "—"
                      );
                    },
                  },
                  {
                    header: copy.patientHeader,
                    cell: (row) => <PersonCell name={row.patientName} />,
                  },
                  {
                    header: copy.practitionerHeader,
                    cell: (row) => (
                      <span className="whitespace-nowrap">
                        {row.practitionerName}
                      </span>
                    ),
                  },
                  {
                    header: copy.typeHeader,
                    cell: (row) => row.appointmentTypeName,
                  },
                  {
                    header: copy.statusHeader,
                    cell: (row) => (
                      <AppointmentStatusBadge status={row.status} />
                    ),
                  },
                ]}
              />
              <RegisterPagination
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                hrefFor={hrefFor}
                label={`${copy.heading} ${REGISTER_COPY.pagination.label.toLowerCase()}`}
              />
            </>
          )
        }
      </AnalyticsPanel>
      <AuditNote />
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Patient register                                                     */
/* ------------------------------------------------------------------ */

export function PatientRegisterCard({
  titleId,
  register,
  hrefFor,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly register: RegisterResult<RegisterPage<PatientRegisterRow>>;
  readonly hrefFor: (page: number) => string;
  readonly retryHref: string;
  readonly className?: string;
}) {
  const copy = REGISTER_COPY.patients;

  return (
    <DashboardCard
      titleId={titleId}
      title={copy.heading}
      description={copy.description}
      className={cn("scroll-mt-6", className)}
    >
      <AnalyticsPanel
        result={register}
        retryHref={retryHref}
        isEmpty={(page) => page.total === 0 && page.page === 1}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
      >
        {(page) =>
          isPastEnd(page) ? (
            <BeyondEnd href={hrefFor(1)} />
          ) : (
            <>
              <AnalyticsTable<PatientRegisterRow>
                embedded
                caption={copy.caption}
                rows={page.rows}
                rowKey={(row) => row.patientId}
                columns={[
                  {
                    header: copy.patientHeader,
                    cell: (row) => (
                      <PersonCell
                        name={row.patientName}
                        badge={row.isNew ? copy.newBadge : undefined}
                      />
                    ),
                  },
                  {
                    header: copy.visitsHeader,
                    numeric: true,
                    cell: (row) => row.appointmentsInPeriod,
                  },
                  {
                    header: copy.lastVisitHeader,
                    cell: (row) => {
                      const moment = row.lastVisitAt
                        ? clinicMoment(row.lastVisitAt)
                        : null;
                      return moment ? (
                        <span className="whitespace-nowrap">{moment.day}</span>
                      ) : (
                        <span className="text-muted-foreground whitespace-nowrap">
                          {copy.noVisit}
                        </span>
                      );
                    },
                  },
                  {
                    header: copy.registeredHeader,
                    cell: (row) => (
                      <span className="whitespace-nowrap">
                        {clinicMoment(row.registeredAt)?.day ?? "—"}
                      </span>
                    ),
                  },
                ]}
              />
              <RegisterPagination
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                hrefFor={hrefFor}
                label={`${copy.heading} ${REGISTER_COPY.pagination.label.toLowerCase()}`}
              />
            </>
          )
        }
      </AnalyticsPanel>
      <AuditNote />
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity                                                      */
/* ------------------------------------------------------------------ */

const ACTIVITY_TITLE: Readonly<Record<ActivityEntry["kind"], string>> = {
  booked: REGISTER_COPY.activity.booked,
  rescheduled: REGISTER_COPY.activity.rescheduled,
  status_changed: REGISTER_COPY.activity.statusChanged,
  patient_registered: REGISTER_COPY.activity.registered,
};

/** The dot's colour follows the event, and the title says it in words. */
const ACTIVITY_DOT: Readonly<Record<ActivityEntry["kind"], string>> = {
  booked: "bg-chart-2",
  rescheduled: "bg-chart-3",
  status_changed: "bg-chart-1",
  patient_registered: "bg-chart-4",
};

export function RecentActivityCard({
  titleId,
  activity,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly activity: RegisterResult<readonly ActivityEntry[]>;
  readonly retryHref: string;
  readonly className?: string;
}) {
  const copy = REGISTER_COPY.activity;

  return (
    <DashboardCard
      titleId={titleId}
      title={copy.heading}
      description={copy.description}
      className={className}
    >
      <AnalyticsPanel
        result={activity}
        retryHref={retryHref}
        isEmpty={(entries) => entries.length === 0}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
      >
        {(entries) => (
          <ol className="relative flex flex-col">
            {entries.map((entry, index) => {
              const moment = clinicMoment(entry.occurredAt);
              const last = index === entries.length - 1;

              return (
                <li
                  key={`${entry.occurredAt}-${entry.patientId}-${index}`}
                  className="relative flex gap-4 pb-5 last:pb-0"
                >
                  {/* The timeline rail. Decorative: order is the list's own. */}
                  <span
                    aria-hidden="true"
                    className="relative flex w-3 shrink-0 justify-center pt-1.5"
                  >
                    <span
                      className={cn(
                        "ring-card relative z-1 size-2.5 rounded-full ring-4",
                        ACTIVITY_DOT[entry.kind],
                      )}
                    />
                    {last ? null : (
                      <span className="bg-border absolute top-4 -bottom-1.5 w-px" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <p className="text-body-sm text-foreground font-sans font-medium">
                        {ACTIVITY_TITLE[entry.kind]}
                      </p>
                      {entry.status && entry.kind !== "booked" ? (
                        <AppointmentStatusBadge status={entry.status} />
                      ) : null}
                    </div>
                    <p className="text-body-sm text-muted-foreground mt-0.5 font-sans">
                      <span className="text-foreground">
                        {entry.patientName}
                      </span>
                      {entry.practitionerName
                        ? ` ${copy.withPractitioner} ${entry.practitionerName}`
                        : null}
                    </p>
                    {moment ? (
                      <p className="text-caption text-muted-foreground mt-0.5 font-sans">
                        <time dateTime={entry.occurredAt}>
                          {moment.day}, {moment.time}
                        </time>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </AnalyticsPanel>
      <AuditNote />
    </DashboardCard>
  );
}
