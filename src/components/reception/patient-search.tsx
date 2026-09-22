"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Search, UserPlus } from "lucide-react";

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
import { searchPatientsAction } from "@/features/reception/actions";
import { PATIENT_SEARCH_COPY } from "@/features/reception/content";
import { formatDateOfBirth, formatPhone } from "@/features/patients/format";
import {
  IDLE_PATIENT_SEARCH_STATE,
  type PatientSearchFormState,
  type PatientSearchResult,
} from "@/features/reception/types";
import { PATIENT_SEARCH_MAX_LENGTH } from "@/features/reception/validation";

/**
 * Finding a patient.
 *
 * ## Why this is a client island and a POST, when almost nothing else here is
 *
 * The obvious implementation is a `GET` form that puts the term in the URL and
 * lets a server component render the results — no JavaScript at all. It was
 * rejected for one reason: a search term at a front desk is somebody's name,
 * and `?q=Priya+Sharma` reaches browser history on a shared machine, every
 * proxy's access log and the `Referer` header of the next request.
 * `phase_10.md` section 36 and `docs/SECURITY.md` section 14 both rule that
 * out.
 *
 * So the search is a `useActionState` POST to a server action. The query still
 * runs on the server, is still authorized there, is still bounded there, and
 * the whole patient list is still never sent to the browser
 * (`phase_10.md` example 2). What changes is that the term is never written
 * anywhere it can be read back.
 *
 * ## Why there is no debounce-as-you-type
 *
 * `phase_10.md` section 12 says "debounced where appropriate". Searching on
 * every keystroke means a request per character — each one a server round trip
 * that reads patient records — to save a receptionist one key press. An
 * explicit submit is one request, it is what Enter already does in a form, and
 * it makes "is it searching?" a state with one answer rather than four in
 * flight. If typing-ahead is ever wanted, it belongs on top of this action
 * rather than instead of it.
 *
 * ## Two modes
 *
 * `onSelect` decides. Without it, a result is a link to the patient's record —
 * the patients page. With it, a result is a button that hands the patient back
 * to a booking flow. One component, because the list, its columns, its empty
 * states and its accessibility are the same either way, and two copies would
 * drift.
 */
export interface PatientSearchProps {
  /**
   * Called when a result is chosen.
   *
   * When absent, results link to the patient's record instead.
   */
  readonly onSelect?: (patient: PatientSearchResult) => void;
  /** Where "register a patient" goes from the empty state. */
  readonly registerHref?: string;
  /** Focuses the input when the component mounts. */
  readonly autoFocus?: boolean;
}

export function PatientSearch({
  onSelect,
  registerHref = "/receptionist/patients/new",
  autoFocus = false,
}: PatientSearchProps) {
  const [state, formAction, pending] = useActionState(
    searchPatientsAction,
    IDLE_PATIENT_SEARCH_STATE,
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
            label={PATIENT_SEARCH_COPY.label}
            description={PATIENT_SEARCH_COPY.description}
          >
            {(control) => (
              <Input
                type="search"
                inputMode="search"
                autoComplete="off"
                autoFocus={autoFocus}
                maxLength={PATIENT_SEARCH_MAX_LENGTH}
                placeholder={PATIENT_SEARCH_COPY.placeholder}
                defaultValue={state.query}
                {...control}
              />
            )}
          </Field>
        </div>

        <Button
          type="submit"
          loading={pending}
          loadingLabel={PATIENT_SEARCH_COPY.searchingLabel}
          className="sm:mb-1"
        >
          {PATIENT_SEARCH_COPY.submitLabel}
        </Button>
      </form>

      <SearchOutcome
        state={state}
        onSelect={onSelect}
        registerHref={registerHref}
      />
    </div>
  );
}

/**
 * Everything that is not the form.
 *
 * Every state `phase_10.md` sections 45-47 asks for is rendered: nothing
 * searched yet, term too short, no matches, and a failed search — none of them
 * a blank area, and each saying what to do next.
 */
function SearchOutcome({
  state,
  onSelect,
  registerHref,
}: {
  readonly state: PatientSearchFormState;
  readonly onSelect?: ((patient: PatientSearchResult) => void) | undefined;
  readonly registerHref: string;
}) {
  if (state.status === "unavailable" || state.status === "forbidden") {
    return (
      <ErrorState
        title={PATIENT_SEARCH_COPY.errorTitle}
        description={PATIENT_SEARCH_COPY.errorDescription}
      />
    );
  }

  if (state.tooShort) {
    return (
      <EmptyState
        icon={<Search />}
        title={PATIENT_SEARCH_COPY.tooShortTitle}
        description={PATIENT_SEARCH_COPY.tooShortDescription}
      />
    );
  }

  if (state.status === "idle") {
    return (
      <EmptyState
        icon={<Search />}
        title={PATIENT_SEARCH_COPY.idleTitle}
        description={PATIENT_SEARCH_COPY.idleDescription}
      />
    );
  }

  if (state.results.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus />}
        title={PATIENT_SEARCH_COPY.emptyTitle}
        description={PATIENT_SEARCH_COPY.emptyDescription}
        action={
          <Button asChild>
            <Link href={registerHref}>{PATIENT_SEARCH_COPY.emptyAction}</Link>
          </Button>
        }
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
        {PATIENT_SEARCH_COPY.boundedNotice}
      </p>

      <PatientResultList results={state.results} onSelect={onSelect} />
    </div>
  );
}

/**
 * The results.
 *
 * Cards below `md`, a real table from `md` up — the same two-layout approach
 * the schedule uses, and for the same reason.
 *
 * Only the columns `phase_10.md` example 6 asks for. There is no address, no
 * emergency contact and no account identifier here, and not because they are
 * filtered: `search_patients` does not return them.
 */
function PatientResultList({
  results,
  onSelect,
}: {
  readonly results: readonly PatientSearchResult[];
  readonly onSelect?: ((patient: PatientSearchResult) => void) | undefined;
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
                  {PATIENT_SEARCH_COPY.phoneHeading}:
                </dt>
                <dd className="min-w-0 wrap-break-word">
                  {formatPhone(patient.phone) ?? "Not given"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">
                  {PATIENT_SEARCH_COPY.dateOfBirthHeading}:
                </dt>
                <dd>{formatDateOfBirth(patient.dateOfBirth) ?? "Not given"}</dd>
              </div>
            </dl>
            <ResultAction patient={patient} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={PATIENT_SEARCH_COPY.resultsCaption}>
          <Table>
            <TableCaption className="sr-only">
              {PATIENT_SEARCH_COPY.resultsCaption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{PATIENT_SEARCH_COPY.nameHeading}</TableHead>
                <TableHead>{PATIENT_SEARCH_COPY.phoneHeading}</TableHead>
                <TableHead>{PATIENT_SEARCH_COPY.dateOfBirthHeading}</TableHead>
                <TableHead>{PATIENT_SEARCH_COPY.cityHeading}</TableHead>
                <TableHead>{PATIENT_SEARCH_COPY.accountHeading}</TableHead>
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
                    {formatPhone(patient.phone) ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateOfBirth(patient.dateOfBirth) ?? "—"}
                  </TableCell>
                  <TableCell>{patient.city ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {patient.hasAccount
                      ? PATIENT_SEARCH_COPY.hasAccountLabel
                      : PATIENT_SEARCH_COPY.noAccountLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <ResultAction patient={patient} onSelect={onSelect} />
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
 * What a result does when chosen.
 *
 * The accessible name always includes the patient's name, because the visible
 * label is identical on every row and a screen-reader user moving between them
 * needs to know which person they are about to open or choose.
 */
function ResultAction({
  patient,
  onSelect,
}: {
  readonly patient: PatientSearchResult;
  readonly onSelect?: ((patient: PatientSearchResult) => void) | undefined;
}) {
  const name = displayName(patient);

  if (onSelect) {
    return (
      <Button
        type="button"
        variant="secondary"
        aria-label={`${PATIENT_SEARCH_COPY.selectLabel} ${name}`}
        onClick={() => onSelect(patient)}
      >
        {PATIENT_SEARCH_COPY.selectLabel}
      </Button>
    );
  }

  return (
    <Link
      href={`/receptionist/patients/${patient.id}`}
      aria-label={`${PATIENT_SEARCH_COPY.viewLabel} ${name}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {PATIENT_SEARCH_COPY.viewLabel}
    </Link>
  );
}

/**
 * What to call this person.
 *
 * The preferred name is what the front desk says out loud, so it leads; the
 * legal name follows in brackets where the two differ, because the legal name
 * is what is on the paperwork somebody is holding.
 */
function displayName(patient: PatientSearchResult): string {
  const preferred = patient.preferredName?.trim();
  if (!preferred || preferred === patient.fullName) return patient.fullName;
  return `${preferred} (${patient.fullName})`;
}
