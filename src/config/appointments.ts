/**
 * Scheduling configuration.
 *
 * ## Why this file exists rather than constants at their use sites
 *
 * `phase_09.md` section 16 asks for booking rules to be configurable and
 * explicitly forbids hard-coding arbitrary business values without documenting
 * them. Section 11 asks for the clinic timezone to be configurable rather than
 * scattered. Both are here, once.
 *
 * ## This is a mirror, and the mirror is checked
 *
 * The authority for every value below is
 * `supabase/migrations/20260920120000_appointment_engine.sql`, because the
 * database is what actually refuses a booking made too soon or too far ahead.
 * These constants exist so the browser can grey out a date rather than let
 * someone pick it and be told no.
 *
 * Two copies of a rule is a divergence waiting to happen, so
 * `src/config/appointments.test.ts` reads the migration and fails if they
 * disagree. That is the same arrangement `lib/design/palette.ts` has with
 * `globals.css`, for the same reason.
 *
 * ## None of these values is confirmed by the clinic
 *
 * Minimum notice and booking horizon are the example values from
 * `phase_09.md` section 16 itself, chosen so the numbers are traceable to a
 * document rather than invented. The booking screen says so in plain words
 * (`features/appointments/content.ts`). They become clinic settings when an
 * administrator can edit them.
 */

/**
 * The timezone the clinic schedules in.
 *
 * Derived from the clinic's **verified** postal address in Satara,
 * Maharashtra (`src/config/clinic.ts`), not guessed. India observes no
 * daylight saving, which is why slot arithmetic in this timezone is exact —
 * but nothing in `features/appointments/time.ts` depends on that, because the
 * offset is resolved per instant through `Intl` rather than assumed.
 *
 * An appointment *instant* is stored as `timestamptz` and is timezone-free.
 * This is only ever used to answer "which clinic day and wall-clock time is
 * that instant?" and the reverse.
 */
export const CLINIC_TIMEZONE = "Asia/Kolkata";

export interface BookingRules {
  /** How far ahead of an appointment a patient must request it. */
  readonly minNoticeMinutes: number;
  /** How far into the future booking is offered at all. */
  readonly maxHorizonDays: number;
  /** The grid offered slots sit on. */
  readonly slotIntervalMinutes: number;
  /**
   * How close to an appointment a patient may still cancel.
   *
   * **Zero, deliberately.** `phase_09.md` section 28 says that where the
   * clinic has not asked for a cutoff, the decision is documented rather than
   * a value invented. So a patient may cancel any appointment that has not yet
   * started, and nothing silently traps somebody into attending.
   */
  readonly cancellationCutoffMinutes: number;
  /**
   * Upcoming requested or confirmed appointments one patient may hold.
   *
   * An abuse bound rather than a clinical rule (`docs/SECURITY.md` section
   * 12): it exists so one account cannot hold the whole diary. Enforced in the
   * database, where it cannot be skipped.
   */
  readonly maxActivePerPatient: number;
}

export const BOOKING_RULES: BookingRules = {
  minNoticeMinutes: 120,
  maxHorizonDays: 90,
  slotIntervalMinutes: 15,
  cancellationCutoffMinutes: 0,
  maxActivePerPatient: 5,
};

/**
 * How many days of availability one request may ask for.
 *
 * The booking flow asks a day at a time, so this is a bound on a hostile
 * request rather than a product decision. The database refuses a wider window
 * as well.
 */
export const MAX_AVAILABILITY_WINDOW_DAYS = 14;

/** The longest note a patient may attach to a booking. Matches the column. */
export const PATIENT_NOTE_MAX_LENGTH = 500;

/** The longest cancellation reason. Matches the column. */
export const CANCELLATION_REASON_MAX_LENGTH = 300;
