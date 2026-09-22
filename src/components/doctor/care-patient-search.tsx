"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Search, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { formatClinicDateShort } from "@/features/appointments/time";
import { searchCarePatientsAction } from "@/features/doctor/actions";
import { DOCTOR_PATIENT_SEARCH_COPY } from "@/features/doctor/content";
import {
  IDLE_CARE_PATIENT_SEARCH_STATE,
  type CarePatientSearchFormState,
  type CarePatientSearchResult,
} from "@/features/doctor/types";
import { CARE_SEARCH_MAX_LENGTH } from "@/features/doctor/validation";
import { formatDateOfBirth, formatPhone } from "@/features/patients/format";

/**
 * Finding a patient the practitioner is booked to see.
 *
 * ## Why this is a client island and a POST, when almost nothing else here is
 *
 * The obvious implementation is a `GET` form that puts the term in the URL
 * and lets a server component render the results — no JavaScript at all. It
 * was rejected for one reason: a search term is somebody's name, and
 * `?q=Priya+Sharma` reaches browser history on a shared consulting-room
 * machine, every proxy's access log and the `Referer` header of the next
 * request. `phase_11.md` section 43 and `docs/SECURITY.md` section 14 both
 * rule that out, and Phase 10 made the same call for the front desk.
 *
 * So the search is a `useActionState` POST to a server action. The query
 * still runs on the server, is still authorized there, is still bounded
 * there, and the patient list is still never sent to the browser
 * (`phase_11.md` section 15 and example 5). What changes is that the term is
 * never written anywhere it can be read back.
 *
 * ## Why there is no search-as-you-type
 *
 * A request per keystroke is a request per keystroke that reads patient
 * records, to save one key press. An explicit submit is one request, it is
 * what Enter already does in a form, and it makes "is it searching?" a state
 * with one answer rather than four in flight.
 *
 * ## The scope is visible, not just documented
 *
 * `phase_11.md` section 16 requires the access model to be chosen and
 * written down. It should also be on the screen: a practitioner who cannot
 * find somebody needs to know whether the search failed or the person is
 * simply not theirs to see.
 */
export function CarePatientSearch({
  autoFocus = false,
}: {
  readonly autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    searchCarePatientsAction,
    IDLE_CARE_PATIENT_SEARCH_STATE,
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        action={formAction}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <Field
            name="query"
            label={DOCTOR_PATIENT_SEARCH_COPY.label}
            description={DOCTOR_PATIENT_SEARCH_COPY.description}
          >
            {(control) => (
              <Input
                type="search"
                inputMode="search"
                autoComplete="off"
                autoFocus={autoFocus}
                maxLength={CARE_SEARCH_MAX_LENGTH}
                placeholder={DOCTOR_PATIENT_SEARCH_COPY.placeholder}
                defaultValue={state.query}
                {...control}
              />
            )}
          </Field>
        </div>

        <Button
          type="submit"
          loading={pending}
          loadingLabel={DOCTOR_PATIENT_SEARCH_COPY.searchingLabel}
          className="sm:mb-1"
        >
          {DOCTOR_PATIENT_SEARCH_COPY.submitLabel}
        </Button>
      </form>

      <SearchOutcome state={state} />
    </div>
  );
}

/**
 * Everything that is not the form.
 *
 * Every state `phase_11.md` sections 40-42 asks for is rendered: nothing
 * searched yet, term too short, no matches, and a failed search — none of
 * them a blank area, and each saying what to do next.
 */
function SearchOutcome({
  state,
}: {
  readonly state: CarePatientSearchFormState;
}) {
  if (state.status === "unavailable" || state.status === "forbidden") {
    return (
      <ErrorState
        title={DOCTOR_PATIENT_SEARCH_COPY.errorTitle}
        description={DOCTOR_PATIENT_SEARCH_COPY.errorDescription}
      />
    );
  }

  if (state.tooShort) {
    return (
      <EmptyState
        icon={<Search />}
        title={DOCTOR_PATIENT_SEARCH_COPY.tooShortTitle}
        description={DOCTOR_PATIENT_SEARCH_COPY.tooShortDescription}
      />
    );
  }

  if (state.status === "idle") {
    return (
      <EmptyState
        icon={<Search />}
        title={DOCTOR_PATIENT_SEARCH_COPY.idleTitle}
        description={DOCTOR_PATIENT_SEARCH_COPY.idleDescription}
      />
    );
  }

  if (state.results.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title={DOCTOR_PATIENT_SEARCH_COPY.emptyTitle}
        description={DOCTOR_PATIENT_SEARCH_COPY.emptyDescription}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        Announced, so a screen-reader user learns the search finished and how
        many people it found rather than having to go looking.
      */}
      <p role="status" className="text-body-sm text-muted-foreground">
        {state.results.length === 1
          ? "1 patient found."
          : `${state.results.length} patients found.`}{" "}
        {DOCTOR_PATIENT_SEARCH_COPY.boundedNotice}
      </p>

      <CarePatientResultList results={state.results} />
    </div>
  );
}

/**
 * The results.
 *
 * Cards below `md`, a real table from `md` up — the same two-layout approach
 * the schedule uses, and for the same reason.
 *
 * Only the columns a practitioner needs to pick the right person. There is no
 * address, no emergency contact and no account identifier here, and not
 * because they are filtered: `search_care_patients` does not return them.
 */
function CarePatientResultList({
  results,
}: {
  readonly results: readonly CarePatientSearchResult[];
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {results.map((patient) => (
          <li
            key={patient.id}
            className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4"
          >
            <p className="text-body text-foreground font-medium wrap-break-word">
              {displayName(patient)}
            </p>
            <dl className="text-body-sm text-muted-foreground flex flex-col gap-1">
              <div className="flex gap-2">
                <dt className="shrink-0">
                  {DOCTOR_PATIENT_SEARCH_COPY.dateOfBirthHeading}:
                </dt>
                <dd>{formatDateOfBirth(patient.dateOfBirth) ?? "Not given"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">
                  {DOCTOR_PATIENT_SEARCH_COPY.lastSeenHeading}:
                </dt>
                <dd>{lastSeen(patient)}</dd>
              </div>
            </dl>
            <OpenPatientLink patient={patient} />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={DOCTOR_PATIENT_SEARCH_COPY.resultsCaption}>
          <Table>
            <TableCaption className="sr-only">
              {DOCTOR_PATIENT_SEARCH_COPY.resultsCaption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{DOCTOR_PATIENT_SEARCH_COPY.nameHeading}</TableHead>
                <TableHead>
                  {DOCTOR_PATIENT_SEARCH_COPY.dateOfBirthHeading}
                </TableHead>
                <TableHead>{DOCTOR_PATIENT_SEARCH_COPY.phoneHeading}</TableHead>
                <TableHead>
                  {DOCTOR_PATIENT_SEARCH_COPY.lastSeenHeading}
                </TableHead>
                <TableHead>
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="text-foreground font-medium">
                    {displayName(patient)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateOfBirth(patient.dateOfBirth) ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPhone(patient.phone) ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {lastSeen(patient)}
                  </TableCell>
                  <TableCell className="text-right">
                    <OpenPatientLink patient={patient} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroller>
      </div>
    </>
  );
}

/**
 * The link to the patient.
 *
 * The visible label is identical on every row, so the accessible name carries
 * the patient's name — a screen-reader user moving between rows needs to know
 * which person they are about to open.
 */
function OpenPatientLink({
  patient,
}: {
  readonly patient: CarePatientSearchResult;
}) {
  return (
    <Link
      href={`/doctor/patients/${patient.id}`}
      aria-label={`${DOCTOR_PATIENT_SEARCH_COPY.viewLabel} ${displayName(patient)}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {DOCTOR_PATIENT_SEARCH_COPY.viewLabel}
    </Link>
  );
}

/**
 * What to call this person.
 *
 * The preferred name is what a practitioner says out loud, so it leads; the
 * name on the record follows in brackets where the two differ, because that
 * is what is on the paperwork.
 */
function displayName(patient: CarePatientSearchResult): string {
  const preferred = patient.preferredName?.trim();
  if (!preferred || preferred === patient.fullName) return patient.fullName;
  return `${preferred} (${patient.fullName})`;
}

function lastSeen(patient: CarePatientSearchResult): string {
  return patient.lastAppointmentAt
    ? formatClinicDateShort(patient.lastAppointmentAt)
    : "—";
}
