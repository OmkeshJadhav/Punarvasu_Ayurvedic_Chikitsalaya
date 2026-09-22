/**
 * The permission vocabulary and the role-to-permission policy.
 *
 * ## Why permissions and not role checks
 *
 * `requireRole("admin")` scattered through a codebase means that the day
 * receptionists are allowed to do one admin-ish thing, the change is a search
 * for every place the string `"admin"` appears. `phase_08.md` sections 13-14
 * ask for a centralized policy so that a capability moves between roles by
 * editing one table.
 *
 * So the rule of thumb, everywhere else in the application: **check a
 * permission, not a role.** `requireRole` exists for the cases where a
 * capability genuinely is "being that kind of person", and this file is the
 * only place a role and a capability are named in the same breath.
 *
 * ## Only what exists
 *
 * `phase_08.md` section 13 is explicit: implement only the permissions
 * required by functionality that exists today, and warns against building a
 * policy engine. Every permission here corresponds to something this
 * application can currently do.
 *
 * Clinical records, prescriptions, documents, notifications and analytics are
 * **not** listed. Declaring `clinical_records.write` now would create a
 * permission that grants access to nothing, that nobody checks, and that has
 * to be re-reasoned about anyway when the table it protects is designed. Each
 * arrives with the feature it protects — which is exactly how the two
 * appointment permissions arrived, in Phase 09, alongside the patient booking
 * surface they guard.
 *
 * The staff appointment capabilities of `docs/SECURITY.md` section 6's matrix
 * — a receptionist booking on a patient's behalf, confirming, or viewing the
 * clinic's diary — are still absent, because those workspaces do not exist.
 * Phase 10 adds them with the screens that use them.
 *
 * ## This module is pure data
 *
 * No server imports, no Supabase, no session. It is safe for a test, a server
 * component or (in principle) a client component to import - but a client
 * reading this table is a *usability* decision, never a security one. The
 * enforcement lives in `lib/authorization/guards.ts` on the server and in
 * row-level security in the database.
 */

import type { AppRole } from "@/types/database";

/**
 * Every capability the application currently authorizes.
 *
 * Named `resource.action.scope`, where the scope distinguishes acting on your
 * own data from acting on anyone's - the distinction `phase_08.md` section 16
 * says role-level authorization alone cannot express.
 */
export const PERMISSIONS = [
  /** Read your own patient record. */
  "profile.read.self",
  /** Create or update your own patient record. */
  "profile.write.self",
  /** Read your own appointments. */
  "appointments.read.self",
  /**
   * Request, reschedule and cancel your own appointments.
   *
   * One permission for all three, because they are one capability — managing
   * your own booking — and splitting them would imply a clinic that lets
   * somebody book but not cancel, which nobody has asked for and which would
   * be a poor thing to build by accident.
   */
  "appointments.write.self",
  /**
   * View and manage **any** appointment in the clinic's diary: create one on a
   * patient's behalf, confirm it, check the patient in, mark a no-show,
   * reschedule and cancel.
   *
   * One permission for the set, for the same reason `appointments.write.self`
   * covers three patient actions: they are one capability — running the
   * clinic's schedule — and splitting them would imply a front desk that can
   * book but not cancel, which nobody has asked for.
   *
   * It does **not** carry any clinical capability. Completing an appointment
   * is deliberately not in it (`phase_10.md` section 31), and the database
   * refuses that status for this role regardless of what any permission says.
   */
  "appointments.manage.any",
  /**
   * Search for a patient and read their **operational** record: name, contact
   * details, date of birth, address, emergency contact.
   *
   * `public.patients` holds nothing else. It has no column for a diagnosis, a
   * symptom, a medication, an allergy, a history or a note, and Phase 07's
   * migration says none may be added — so this permission cannot widen into
   * clinical access by someone adding a field.
   */
  "patients.read.operational",
  /**
   * Create a patient record at the front desk for somebody who does not have
   * one yet.
   *
   * Separate from reading, because they are separate capabilities and because
   * creating a record is the one that can put a wrong person in the system.
   * It confers no ability to create an account, set a credential or assign a
   * role — the database function it authorizes has no parameter for any of
   * those.
   */
  "patients.write.operational",
  /**
   * View the practitioner's **own** diary: today's schedule, upcoming and
   * past appointments, and one appointment's detail.
   *
   * "Own" is not a hint. The scope is the caller's own practitioner record,
   * resolved from `auth.uid()` in the database, and row-level security is
   * what enforces it — Phase 09's `appointments_select_own_practitioner`
   * policy, which scopes by the practitioner relationship and never by the
   * doctor role alone.
   */
  "appointments.read.own_schedule",
  /**
   * Act on an appointment in the practitioner's own diary: confirm it, start
   * the consultation, complete it, or record that the patient did not attend.
   *
   * It carries **no** ability to cancel and no ability to reschedule. Both
   * change a patient's plans and need somebody to tell them, which is the
   * front desk's work (`phase_11.md` section 21).
   */
  "appointments.manage.own_schedule",
  /**
   * Read and search the patients in the practitioner's **own care scope**.
   *
   * `docs/SECURITY.md` section 6: a doctor's access to a patient is scoped by
   * treatment relationship rather than by role. The relationship is an
   * appointment between that patient and this practitioner, and the database
   * decides it — `public.doctor_has_care_relationship()`, behind the
   * `patients_select_doctor_care` policy. Holding this permission reaches no
   * patient a doctor has never been booked to see.
   *
   * It is operational and demographic, exactly as
   * `patients.read.operational` is. `public.patients` has no clinical column
   * and Phase 07's migration says none may be added, so this permission
   * cannot widen into clinical access; the clinical record is its own table
   * with its own policies and its own two permissions, below.
   */
  "patients.read.care",
  /**
   * Read the clinical records the practitioner **authored**.
   *
   * `phase_12.md` section 20 requires the access policy to be chosen
   * explicitly rather than assumed to be the broadest one. It is the
   * **authoring-practitioner** model: a doctor reads a clinical record when
   * its `practitioner_id` is their own practitioner record, decided by the
   * `clinical_records_select_author` policy and by nothing in application
   * code.
   *
   * Holding this permission reaches no record a doctor did not write. It is
   * narrower than `patients.read.care`, deliberately: being booked to see
   * somebody lets a practitioner read who they are, and does not let them
   * read what a colleague concluded about them.
   *
   * Granted to the doctor role alone. Section 22 makes the receptionist
   * boundary a hard one, section 21 says a patient-facing view must be a
   * deliberately authorized projection rather than this, and section 23 says
   * administrative capability is not clinical access.
   */
  "clinical_records.read",
  /**
   * Start a consultation, save a draft clinical record, and complete it.
   *
   * One permission for the three, for the same reason
   * `appointments.write.self` covers three patient actions: they are one
   * capability — documenting a consultation — and a clinic that lets a
   * practitioner start notes but not finish them is not a thing anybody has
   * asked for.
   *
   * It confers no ability to edit a completed record, delete a record, or
   * write one for a colleague's patient. None of those is a permission
   * check: the first is refused by `clinical_records_guard_update()`, the
   * second has no function and no grant at all, and the third reaches no row.
   */
  "clinical_records.write",
  /**
   * Read the prescriptions this practitioner authored, at any status, and a
   * patient's prescription history within that scope.
   *
   * The authoring-practitioner model again, unchanged from Phase 12: a
   * doctor reads what they wrote and not what a colleague wrote. Decided by
   * `prescriptions_select_author`, not by this permission — this one decides
   * whether the *page* renders at all.
   */
  "prescriptions.read",
  /**
   * Create a draft prescription, edit its items, issue it, and withdraw it.
   *
   * One permission for the four, because they are one capability:
   * prescribing. A clinic that let a practitioner draft a prescription but
   * not issue it is not a thing anybody has asked for.
   *
   * It confers no ability to edit an issued prescription or delete one.
   * Neither is a permission check: the first is refused by
   * `prescriptions_guard_update()` and `prescription_items_guard_write()`,
   * and the second has no function, no grant and no policy at all.
   */
  "prescriptions.write",
  /**
   * A patient reading **their own issued** prescriptions.
   *
   * The `.self` suffix is the same promise `profile.read.self` and
   * `appointments.read.self` make, and it is enforced the same way: the
   * query is scoped to the session and `prescriptions_select_patient` scopes
   * it again. What this permission does *not* say, and the database does, is
   * that a **draft is never visible** — `status <> 'draft'` lives in the
   * policy, so no query can forget it.
   */
  "prescriptions.read.self",
  /** Read the treatment plans this practitioner wrote. */
  "treatment_plans.read",
  /**
   * Create a draft treatment plan, edit it, activate it, complete it and
   * withdraw it. One capability: planning care.
   */
  "treatment_plans.write",
  /** A patient reading **their own active** treatment plans. */
  "treatment_plans.read.self",
  /**
   * A patient reading **their own** documents.
   *
   * The `.self` suffix is the same promise `profile.read.self` and
   * `prescriptions.read.self` make, and it is enforced the same way: the
   * query is scoped to the session and `patient_documents_select_own` scopes
   * it again. It reaches no document on anybody else's record, at any
   * status.
   */
  "documents.read.self",
  /**
   * A patient uploading a document to their **own** record, and archiving
   * one they uploaded.
   *
   * One permission for both, because they are one capability — keeping your
   * own documents. It confers no ability to archive a document the clinic
   * uploaded: `archive_patient_document` resolves the row by id **and** by
   * the caller being the uploader, so that is not a permission check at all.
   */
  "documents.write.self",
  /**
   * Read the documents of the patients this practitioner is **booked to
   * see**.
   *
   * `phase_14.md` sections 18 and 21, and the care-relationship model of
   * Phase 11: decided by `patient_documents_select_doctor_care`, which
   * requires an appointment between that patient and the caller's own
   * practitioner record. Holding this permission reaches no patient a doctor
   * has never been booked to see.
   *
   * It is deliberately **wider** than `clinical_records.read`, which is
   * scoped to what the practitioner authored. A lab report is evidence the
   * patient brought for whoever is treating them, not a colleague's
   * conclusion about them; the reasoning is in the Phase 14 migration's
   * header.
   */
  "documents.read.care",
  /**
   * Upload a document from one of this practitioner's own appointments, and
   * archive one they uploaded.
   *
   * The patient, the appointment and the consultation are inherited from
   * where the practitioner is working (section 47) — there is no patient
   * parameter anywhere in the feature for this permission to be combined
   * with.
   */
  "documents.write.care",
  /**
   * Read **your own** notifications, and the unread count behind the bell.
   *
   * The only permission in this table held by every role, and deliberately so.
   * A notification is not clinical data and not somebody else's data: it is a
   * message addressed to one account, and the account it is addressed to was
   * decided in the database from the resource it is about. Every role has
   * appointments, prescriptions or a diary that can produce one — today only a
   * patient does, but the capability belongs to "being signed in", not to
   * being a patient.
   *
   * The `.self` suffix is the same promise `profile.read.self` makes, enforced
   * the same way: the query takes no user id and `notifications_select_own`
   * scopes it again. It also carries `status = 'active'`, so a scheduled
   * reminder is invisible even to the person it is for until its time comes.
   */
  "notifications.read.self",
  /**
   * Mark **your own** notifications read, and change **your own** preferences.
   *
   * One permission for both, because they are one capability — managing how
   * the clinic reaches you. It confers no ability to send anything: creating a
   * notification is `create_notification`, which is granted to `service_role`
   * alone and has no parameter for a recipient, a title, a body or a link
   * (`phase_15.md` sections 109, 110).
   */
  "notifications.write.self",
  /**
   * Read clinic-wide **operational** analytics: appointment volume and
   * outcomes, the appointment trend, practitioner workload, and patient
   * growth.
   *
   * Held by the administrator and the receptionist. `phase_16.md` section 6
   * gives the front desk "operational scheduling analytics appropriate to
   * their role", and these are the numbers about their own work — they
   * already see every appointment in the diary and register every walk-in, so
   * counting those is not a widening of what they can reach.
   *
   * It carries nothing clinical. The figures it unlocks are counts of
   * appointments and of patient records; a prescription, a plan, a
   * consultation and a document are behind `analytics.read.clinic`, which a
   * receptionist does not hold.
   */
  "analytics.read.operational",
  /**
   * Read the whole clinic picture: everything above, plus notification
   * delivery performance and aggregate clinical **activity** counts.
   *
   * Administrator only. Notification delivery is a systems concern rather
   * than a scheduling one, and a count of prescriptions issued sits on the far
   * side of `docs/SECURITY.md` section 6's "receptionist is operational,
   * never clinical" boundary. An aggregate is not a prescription — but that
   * line is worth keeping bright rather than re-argued per figure, and the
   * database's own gate draws it in the same place.
   */
  "analytics.read.clinic",
  /**
   * Read **your own practice's** analytics: your appointment volume and
   * outcomes, your trend, and your booked-against-working time.
   *
   * The doctor role, and the scope is not this permission's to decide. There
   * is no practitioner argument on any of the three RPCs it unlocks: the
   * scope is resolved from `auth.uid()` by `assert_care_practitioner()`, the
   * same gate Phases 11-14 use. Holding this reaches no colleague's figures
   * and no clinic-wide total, because neither is in any return type
   * (`phase_16.md` sections 8 and 54, example 3).
   */
  "analytics.read.own_practice",
  /**
   * Generate and download an operational report.
   *
   * Deliberately **not** implied by any read permission. Section 44 asks for
   * export to be a stronger capability than viewing, and the reason is that a
   * file leaves the building: a dashboard is read by somebody signed in at a
   * clinic machine, and a CSV is opened on a laptop, attached to an email and
   * kept.
   *
   * It confers no wider *content*: the one report it unlocks is aggregated
   * counts per day, practitioner, appointment type and status, and there is
   * no patient identifier in it at all.
   */
  "reports.export",
  /**
   * Use doctor-facing clinical AI decision support.
   *
   * `phase_17.md` section 5: the doctor role, and nobody else. A receptionist
   * must not reach clinical AI, a patient must not reach internal clinical AI,
   * and an administrator does **not** get it by virtue of being an
   * administrator — the same argument every clinical permission since Phase 12
   * has made, and here it is stronger, because an administrator has no
   * practitioner record and therefore no patient a model could be asked about.
   *
   * ## What holding it does not confer
   *
   * It does not reach a patient: the appointment is resolved by the caller's
   * own practitioner record inside `start_ai_assistance_session`, and the
   * context is read under the same policies the consultation screen uses. It
   * does not choose a model, a prompt or a temperature: none of those is a
   * request parameter. And it confers **no ability to write anything** — there
   * is no path from an AI result to a clinical record, a prescription, a
   * treatment plan, an appointment or a notification, in this permission or
   * anywhere else (sections 76, 111-115).
   *
   * One permission rather than a read and a write, because there is only one
   * capability: asking. There is nothing here to write.
   *
   * Separate from `clinical_records.*` deliberately. Clinical AI can be
   * withdrawn from the doctor role — by deleting one line here — without
   * touching a practitioner's ability to document a consultation, which is
   * the switch section 119 asks for at the authorization layer rather than
   * only at the feature flag.
   */
  "clinical_ai.use",
  /** List the clinic's user accounts and the role each one holds. */
  "users.read",
  /** Assign an application role to another user. */
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The canonical four roles (`docs/SECURITY.md` section 6), in order of
 * increasing privilege for display purposes only. Nothing derives authority
 * from this order - there is no role hierarchy, and a doctor does not inherit
 * a receptionist's permissions.
 */
export const APP_ROLES = [
  "patient",
  "receptionist",
  "doctor",
  "admin",
] as const satisfies readonly AppRole[];

/**
 * Human-readable role names, for a screen that has a legitimate reason to show
 * one - the administrator's access-management table, and the signed-in user's
 * own account page.
 *
 * Never used in a forbidden message. `phase_08.md` section 12 and its example
 * 6 rule out telling a user which role they would have needed.
 */
export const ROLE_LABELS: Readonly<Record<AppRole, string>> = {
  patient: "Patient",
  receptionist: "Receptionist",
  doctor: "Doctor",
  admin: "Administrator",
};

/** One sentence on what a role is for. Shown in the role-assignment form. */
export const ROLE_DESCRIPTIONS: Readonly<Record<AppRole, string>> = {
  patient:
    "Someone receiving care. Can manage their own details and, in future, their own appointments and records.",
  receptionist:
    "Front-desk staff. Operational access only — scheduling and patient contact details, never clinical information.",
  doctor:
    "A practitioner delivering care and authoring clinical records for the patients they treat.",
  admin:
    "Clinic administration: staff access, services, availability and settings. Highly privileged.",
};

/**
 * **The policy.** What each role may do.
 *
 * Read it as the whole answer: a role's permissions are exactly the entries
 * listed against it. There is no inheritance and no wildcard, because both
 * make "what can a receptionist do?" a question you answer by tracing code
 * rather than by reading a table.
 *
 * ### A permission arrives with the surface it protects
 *
 * `docs/SECURITY.md` section 2.4 asks for new capability to start from the
 * most restrictive reasonable configuration and be granted explicitly. Phase
 * 09 held to that: two appointment permissions, granted to the patient role
 * only, because a patient booking screen was the only appointment surface that
 * existed. Phase 10 does the same — the three receptionist permissions below
 * arrive in the same change as `/receptionist`, and not before.
 *
 * Phase 11 adds the doctor's three, in the same change as `/doctor`. They are
 * deliberately *not* the receptionist's: a doctor manages their own diary and
 * reads the patients they are booked to see, and holds no clinic-wide
 * capability at all.
 *
 * Phase 12 adds the doctor's clinical two, in the same change as
 * `public.clinical_records` and the consultation workspace — which is the
 * rule this comment has been describing since Phase 08 finally applied to a
 * clinical permission. They go to the doctor role and to nobody else: not the
 * receptionist (`docs/SECURITY.md` section 6's hard boundary), not the
 * patient (a patient-facing view would be its own authorized projection), and
 * not the admin (administrative capability is not clinical access, and
 * clinical access for an administrator needs an audit trail that does not
 * exist).
 *
 * Phase 13 adds six, in the same change as `public.prescriptions`,
 * `public.treatment_plans` and the builders that write them. Four go to the
 * doctor and **two go to the patient** — the first clinical permissions a
 * patient has ever held, and they are deliberately narrow: `.read.self` says
 * *your own*, and the database adds *and only once the doctor has issued it*
 * (`prescriptions_select_patient`). `docs/SECURITY.md` section 6's matrix has
 * always read "Prescriptions | View own" for a patient; this is the phase
 * that builds the surface, so this is the phase that declares it. The
 * receptionist and the administrator hold none of the six — the matrix marks
 * both "No" and "Read, audited" respectively, and the audit subsystem that
 * second phrase depends on does not exist.
 *
 * Phase 14 adds four, in the same change as `public.patient_documents`, the
 * private bucket and the two surfaces that use them. Two go to the patient
 * and two to the doctor, and the matrix row they implement is "Patient
 * documents | Own | Upload only | Treated patients | Controlled, audited".
 *
 * The **receptionist gets none of them**, including the matrix's "Upload
 * only": that describes an operational workflow nobody has designed, it
 * would need its own narrowly scoped permission and its own surface, and
 * `phase_14.md` section 19 is explicit that a receptionist must not be given
 * document access merely for holding the role. The **administrator gets none
 * either** — section 20, and the same audit argument as every clinical
 * permission since Phase 12.
 *
 * The doctor's read is the first clinical-adjacent permission in the product
 * that is scoped by the **care relationship** rather than by authorship. That
 * is deliberate and is reasoned about in the permission's own comment.
 *
 * Phase 15 adds two, in the same change as `public.notifications` and the
 * notification centre — and they are the first permissions in this table held
 * by **every** role. That is not a relaxation of the rule above: a
 * notification is a message addressed to one account, it is not clinical data
 * and it is not somebody else's data, and the capability belongs to "being
 * signed in" rather than to being a patient. Only a patient can receive one
 * today, because only patient-facing events are implemented; staff
 * notifications are deferred (`phase_15.md` section 56 asks for useful
 * workflows rather than every database event), and when they arrive the
 * permission is already the right shape.
 *
 * Neither confers any ability to *send*. `create_notification` is granted to
 * `service_role` alone and takes no recipient, so there is no combination of
 * permissions in this table that lets one person cause a message to reach
 * another (section 109).
 *
 * ### Why the admin does not hold the receptionist's permissions
 *
 * `docs/SECURITY.md` section 6's matrix marks the front-desk capabilities
 * "Controlled" for an administrator, which is a statement about a surface that
 * does not exist: there is no administrative scheduling screen, and no audit
 * trail for administrative access to patient records. Granting them here would
 * be granting them through a UI nobody has designed, so it waits for the phase
 * that designs it.
 *
 * ### Why an admin is not also a patient
 *
 * The four `*.self` permissions are a patient's own clinic record and their
 * own bookings. `docs/SECURITY.md` section 6 says a staff member who is also a
 * patient of the clinic uses a separate patient account, which keeps every
 * authorization decision unambiguous - so no staff role carries them.
 */
export const PERMISSIONS_BY_ROLE: Readonly<
  Record<AppRole, readonly Permission[]>
> = {
  patient: [
    "profile.read.self",
    "profile.write.self",
    "appointments.read.self",
    "appointments.write.self",
    "prescriptions.read.self",
    "treatment_plans.read.self",
    "documents.read.self",
    "documents.write.self",
    "notifications.read.self",
    "notifications.write.self",
  ],
  receptionist: [
    "appointments.manage.any",
    "patients.read.operational",
    "patients.write.operational",
    "analytics.read.operational",
    "notifications.read.self",
    "notifications.write.self",
  ],
  doctor: [
    "appointments.read.own_schedule",
    "appointments.manage.own_schedule",
    "patients.read.care",
    "clinical_records.read",
    "clinical_records.write",
    "prescriptions.read",
    "prescriptions.write",
    "treatment_plans.read",
    "treatment_plans.write",
    "documents.read.care",
    "documents.write.care",
    "clinical_ai.use",
    "analytics.read.own_practice",
    "notifications.read.self",
    "notifications.write.self",
  ],
  admin: [
    "users.read",
    "roles.manage",
    "analytics.read.operational",
    "analytics.read.clinic",
    "reports.export",
    "notifications.read.self",
    "notifications.write.self",
  ],
};
