/**
 * Supabase database types.
 *
 * Normally generated: `npm run db:types` regenerates this file from the linked
 * project, and that remains the way to change it after every migration - see
 * `supabase/README.md`.
 *
 * This revision was written by hand to match
 * `supabase/migrations/20260917120000_auth_identity_foundation.sql`,
 * `supabase/migrations/20260918120000_patient_profile.sql`,
 * `supabase/migrations/20260919120000_roles_and_permissions.sql`,
 * `supabase/migrations/20260920120000_appointment_engine.sql`,
 * `supabase/migrations/20260921120000_receptionist_workspace.sql`,
 * `supabase/migrations/20260922120000_doctor_workspace.sql` and
 * `supabase/migrations/20260923120000_clinical_records.sql`, because no
 * Supabase project is linked in this environment and the generator therefore
 * cannot run. The shape follows what the generator emits, so regenerating over
 * it is a clean overwrite rather than a merge. **Regenerate this file once the
 * migrations have been applied to a real project**, and treat a difference
 * between the two as a defect in the hand-written version.
 *
 * One deliberate divergence from the generator, carried since Phase 08: where
 * a table has no insert, update or delete grant for any client role, the
 * corresponding shape is typed `never` rather than a full column list. That
 * turns "this write will be refused at runtime" into "this write does not
 * compile", which is a much better place to find out.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * The canonical role model (`docs/SECURITY.md` section 6).
 *
 * Re-exported as a named type because application code needs to name a role
 * without reaching into the generated table shapes. A user holds exactly one.
 */
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        /**
         * Phase 08 moved the role out of this table entirely, into
         * `user_roles`. `authenticated` may update `full_name` and `phone`,
         * which is the whole of what this table now holds beyond its id.
         */
        Update: {
          full_name?: string | null;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * The authoritative role assignment (Phase 08).
       *
       * `Insert`, `Update` and `Delete` shapes are deliberately impossible to
       * express usefully: `authenticated` holds `select` and nothing else, and
       * there is no insert, update or delete policy. Roles are assigned by
       * calling `assign_user_role`, which authorizes the caller in the
       * database. Both write shapes are typed `never` so that reaching for
       * `.insert()` or `.update()` on this table is a compile error rather
       * than a runtime permission failure somebody discovers in production.
       */
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * The role-change audit trail (Phase 08). Read-only for admins, written
       * only by `assign_user_role` running as definer — hence `never` for both
       * write shapes.
       */
      role_assignment_events: {
        Row: {
          id: string;
          actor_id: string | null;
          target_user_id: string;
          previous_role: AppRole | null;
          new_role: AppRole;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          preferred_name: string | null;
          phone: string | null;
          date_of_birth: string | null;
          gender: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          emergency_contact_name: string | null;
          emergency_contact_relationship: string | null;
          emergency_contact_phone: string | null;
          preferred_language: string | null;
          created_at: string;
          updated_at: string;
        };
        /**
         * `id`, `created_at` and `updated_at` are absent: the database
         * generates all three, and `phase_07.md` sections 57-58 require that a
         * client cannot supply a timestamp.
         *
         * `profile_id` *is* present, because creating a record means claiming
         * ownership of it — but the insert policy rejects any value other than
         * the caller's own `auth.uid()`, so the only row a caller can create
         * is their own.
         */
        Insert: {
          profile_id: string;
          full_name: string;
          preferred_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_relationship?: string | null;
          emergency_contact_phone?: string | null;
          preferred_language?: string | null;
        };
        /**
         * `profile_id` is absent on purpose, matching the column-level grant:
         * `authenticated` may update the demographic columns only. Re-pointing
         * a record at another user is a type error here, a permission error at
         * the grant, and an exception at the `patients_guard_ownership`
         * trigger.
         */
        Update: {
          full_name?: string;
          preferred_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_relationship?: string | null;
          emergency_contact_phone?: string | null;
          preferred_language?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patients_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * A practitioner's scheduling identity (Phase 09).
       *
       * `authenticated` holds a column-scoped `select` on active rows and
       * nothing else, so both write shapes are `never`. Practitioner
       * administration arrives with the staff workspaces in Phase 10/11.
       *
       * Note what is *not* in `Row`: no qualification, registration number,
       * specialisation or biography. Those are clinical credentials the clinic
       * has not confirmed, and there is deliberately nowhere here to put one.
       */
      practitioners: {
        Row: {
          id: string;
          display_name: string;
          is_active: boolean;
          accepts_online_booking: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "practitioners_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      /** The trusted source of appointment duration and buffer (Phase 09). */
      appointment_types: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          buffer_minutes: number;
          is_active: boolean;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Recurring working intervals. `starts_at`/`ends_at` are SQL `time`. */
      practitioner_availability: {
        Row: {
          id: string;
          practitioner_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          is_active: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "practitioner_availability_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Blocked periods (Phase 09).
       *
       * RLS is enabled with **no policy at all**, so every client read returns
       * zero rows — the `reason` column may be personal. `Row` is `never` to
       * make that structural rather than a convention: reading this table from
       * application code does not compile. Availability goes through
       * `get_practitioner_busy_intervals`, which returns boundaries only.
       */
      schedule_exceptions: {
        Row: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * Appointments (Phase 09).
       *
       * `Row` is the **column-level select grant**, not the table. There is no
       * `internal_note` here because `authenticated` holds no grant on that
       * column: a patient cannot read it through any query, and a component
       * cannot expect it. `blocked_until`, `created_by` and `cancelled_by` are
       * absent for the same reason.
       *
       * Both write shapes are `never`: no client role holds insert, update or
       * delete. Every write is `book_appointment`, `cancel_appointment` or
       * `reschedule_appointment`, each of which derives the patient, the
       * duration and the status itself.
       */
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          practitioner_id: string;
          appointment_type_id: string;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          patient_note: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_appointment_type_id_fkey";
            columns: ["appointment_type_id"];
            isOneToOne: false;
            referencedRelation: "appointment_types";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Insert-only appointment history (Phase 09). Written by the functions. */
      appointment_events: {
        Row: {
          id: string;
          appointment_id: string;
          event_type: Database["public"]["Enums"]["appointment_event_type"];
          previous_status:
            Database["public"]["Enums"]["appointment_status"] | null;
          new_status: Database["public"]["Enums"]["appointment_status"] | null;
          previous_starts_at: string | null;
          previous_ends_at: string | null;
          new_starts_at: string | null;
          new_ends_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Clinical records (Phase 12) — the first clinical data in the schema.
       *
       * `Row` is every column, because the only caller who can reach a row at
       * all is the practitioner who authored it:
       * `clinical_records_select_author` is the single policy, and no
       * receptionist, patient or administrator matches it.
       *
       * Both write shapes are `never`. No client role holds insert, update or
       * delete on this table and there is no such policy, so every write is
       * `start_consultation`, `save_clinical_draft` or
       * `complete_clinical_record` — each of which derives the patient and the
       * practitioner from the appointment and sets the status itself.
       */
      clinical_records: {
        Row: {
          id: string;
          appointment_id: string;
          patient_id: string;
          practitioner_id: string;
          status: Database["public"]["Enums"]["clinical_record_status"];
          chief_complaint: string | null;
          history_of_presenting_concern: string | null;
          symptoms: string | null;
          clinical_observations: string | null;
          assessment: string | null;
          diagnosis_or_clinical_impression: string | null;
          doctor_notes: string | null;
          follow_up_notes: string | null;
          version: number;
          created_by: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "clinical_records_appointment_consistency";
            columns: ["appointment_id", "patient_id", "practitioner_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id", "patient_id", "practitioner_id"];
          },
          {
            foreignKeyName: "clinical_records_patient_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinical_records_practitioner_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Prescriptions (Phase 13) — a doctor's finalized clinical instruction.
       *
       * `Row` omits the five actor columns — `created_by`, `issued_by` and
       * `cancelled_by` — because they are **not in the select grant**. A
       * column privilege belongs to a database role and a patient and a
       * doctor are both `authenticated`, so a column readable by one is
       * readable by the other; nothing on a screen needs them, so nothing
       * reads them.
       *
       * Both write shapes are `never`. No client role holds insert, update or
       * delete on this table and there is no such policy, so every write is
       * `create_prescription`, `save_prescription_draft`,
       * `issue_prescription` or `cancel_prescription` — each of which derives
       * the patient, the practitioner and the appointment from the clinical
       * record and sets the status itself.
       */
      prescriptions: {
        Row: {
          id: string;
          clinical_record_id: string;
          appointment_id: string;
          patient_id: string;
          practitioner_id: string;
          status: Database["public"]["Enums"]["prescription_status"];
          general_instructions: string | null;
          version: number;
          issued_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinical_record_consistency";
            columns: [
              "clinical_record_id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ];
            isOneToOne: false;
            referencedRelation: "clinical_records";
            referencedColumns: [
              "id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ];
          },
          {
            foreignKeyName: "prescriptions_patient_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_practitioner_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_appointment_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * What was prescribed, as the doctor wrote it (Phase 13).
       *
       * There is deliberately **no `medicine_id`**: the clinic has no
       * verified catalog, and `phase_13.md` section 9 forbids inventing one.
       * Every clinically relevant value is a snapshot, so a catalog added
       * later cannot rewrite an issued prescription (sections 51–52).
       */
      prescription_items: {
        Row: {
          id: string;
          prescription_id: string;
          sort_order: number;
          medicine_name: string;
          form: string | null;
          strength: string | null;
          dose_amount: string | null;
          dose_unit: string | null;
          frequency: string | null;
          timing: string | null;
          duration: string | null;
          quantity: string | null;
          quantity_unit: string | null;
          instructions: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey";
            columns: ["prescription_id"];
            isOneToOne: false;
            referencedRelation: "prescriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Treatment plans (Phase 13). Actor columns omitted for the same reason. */
      treatment_plans: {
        Row: {
          id: string;
          clinical_record_id: string;
          appointment_id: string;
          patient_id: string;
          practitioner_id: string;
          status: Database["public"]["Enums"]["treatment_plan_status"];
          title: string | null;
          summary: string | null;
          start_date: string | null;
          follow_up_on: string | null;
          version: number;
          activated_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinical_record_consistency";
            columns: [
              "clinical_record_id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ];
            isOneToOne: false;
            referencedRelation: "clinical_records";
            referencedColumns: [
              "id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ];
          },
          {
            foreignKeyName: "treatment_plans_patient_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_plans_practitioner_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_plans_appointment_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      /** The structured sections of a treatment plan (Phase 13). */
      treatment_plan_items: {
        Row: {
          id: string;
          treatment_plan_id: string;
          sort_order: number;
          category: Database["public"]["Enums"]["treatment_plan_category"];
          title: string;
          instructions: string | null;
          frequency: string | null;
          duration: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey";
            columns: ["treatment_plan_id"];
            isOneToOne: false;
            referencedRelation: "treatment_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Metadata and authorization for a patient document (Phase 14).
       *
       * The file itself lives in the private `patient-documents` bucket and
       * is reachable only through a short-lived signed URL minted after
       * authorization.
       *
       * `uploaded_by` and `archived_by` are deliberately **absent from the
       * Row shape**, because they are absent from the select grant: a column
       * privilege belongs to a database role, and a patient and a doctor are
       * both `authenticated`, so a column readable by one is readable by the
       * other.
       */
      patient_documents: {
        Row: {
          id: string;
          patient_id: string;
          uploaded_by_role: Database["public"]["Enums"]["patient_document_uploader"];
          uploaded_by_practitioner_id: string | null;
          document_type: Database["public"]["Enums"]["patient_document_type"];
          title: string;
          description: string | null;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          status: Database["public"]["Enums"]["patient_document_status"];
          appointment_id: string | null;
          clinical_record_id: string | null;
          archived_at: string | null;
          archive_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_documents_practitioner_fkey";
            columns: ["uploaded_by_practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_documents_appointment_consistency";
            columns: ["appointment_id", "patient_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id", "patient_id"];
          },
          {
            foreignKeyName: "patient_documents_clinical_record_consistency";
            columns: ["clinical_record_id", "patient_id"];
            isOneToOne: false;
            referencedRelation: "clinical_records";
            referencedColumns: ["id", "patient_id"];
          },
        ];
      };
      /**
       * The transactional outbox (Phase 15).
       *
       * Written by after-triggers on the domain tables, inside the domain
       * transaction. **No client role holds any grant on it at all** — not
       * `anon`, not `authenticated`, not `service_role` — and it carries no
       * row-level security policy, so the `Row` shape below describes what
       * the processor's definer functions return rather than anything a
       * query can reach.
       */
      notification_outbox: {
        Row: {
          id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          subject_type: Database["public"]["Enums"]["notification_subject_type"];
          subject_id: string;
          dedupe_key: string;
          status: Database["public"]["Enums"]["notification_outbox_status"];
          attempt_count: number;
          available_at: string;
          occurred_at: string;
          processed_at: string | null;
          last_error_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * One thing an account should know (Phase 15).
       *
       * `authenticated` holds a column-scoped `select` and nothing else;
       * read state and preferences change through definer functions that
       * take no user id, so both write shapes are `never`.
       *
       * `dedupe_key`, `audience`, `reminder_offset_minutes`, `cancelled_at`
       * and `updated_at` are absent from the `Row` shape because they are
       * absent from the select grant: they are the machinery, not the
       * message. The row carries the title and body that were rendered for
       * its audience, and those are what a reader sees.
       */
      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          category: Database["public"]["Enums"]["notification_category"];
          title: string;
          body: string;
          template_version: number;
          resource_type: Database["public"]["Enums"]["notification_subject_type"];
          resource_id: string;
          link_path: string;
          status: Database["public"]["Enums"]["notification_status"];
          scheduled_for: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * One external delivery attempt (Phase 15). Like the outbox, no client
       * role holds a grant and there is no policy: `phase_15.md` section 107
       * forbids the browser updating a delivery status, and the strongest
       * form of that is having nowhere to update it from.
       */
      notification_deliveries: {
        Row: {
          id: string;
          notification_id: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          provider: string;
          status: Database["public"]["Enums"]["notification_delivery_status"];
          attempt_count: number;
          provider_message_id: string | null;
          error_code: string | null;
          available_at: string;
          last_attempt_at: string | null;
          sent_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * A communication preference (Phase 15). Readable by its owner;
       * written only by `set_notification_preference`, which takes no user
       * id — hence `never` for both write shapes.
       */
      notification_preferences: {
        Row: {
          user_id: string;
          category: Database["public"]["Enums"]["notification_category"];
          channel: Database["public"]["Enums"]["notification_channel"];
          enabled: boolean;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * The AI assistance audit (Phase 17).
       *
       * `Row` is declared for completeness and is unreachable from any client:
       * the table has **no select policy at all** and no grant, so a query
       * against it returns nothing for every role. The four definer functions
       * are the whole interface.
       *
       * `Insert` and `Update` are `never`, like every clinical table since
       * Phase 12 — which makes a client table write a compile error as well as
       * a privilege error.
       *
       * Note what is not in `Row`: no prompt, no response, no summary, no
       * consideration, no confidence. There is no column for any of them.
       */
      ai_assistance_sessions: {
        Row: {
          id: string;
          practitioner_id: string;
          patient_id: string;
          appointment_id: string;
          clinical_record_id: string | null;
          task: Database["public"]["Enums"]["ai_assistance_task"];
          prompt_version: string;
          provider: string;
          model: string;
          status: Database["public"]["Enums"]["ai_assistance_status"];
          failure_code: string | null;
          latency_ms: number | null;
          input_tokens: number | null;
          output_tokens: number | null;
          context_fingerprint: string;
          created_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ai_assistance_sessions_practitioner_id_fkey";
            columns: ["practitioner_id"];
            isOneToOne: false;
            referencedRelation: "practitioners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistance_sessions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_assistance_sessions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    /**
     * Phase 19. The security audit trail: who reached what, when, and
     * whether they were allowed to.
     *
     * `Insert` and `Update` are `never` on purpose. There is no client write
     * grant and no write policy; the only path in is
     * `record_security_audit_event`, and typing them `never` makes a table
     * write a compile error as well as a runtime refusal.
     *
     * No foreign key on `actor_id`: the record of who reached a patient's
     * file outlives the account, and a referential action would collide with
     * the table's own immutability trigger.
     */
    security_audit_events: {
      Row: {
        id: string;
        occurred_at: string;
        actor_id: string | null;
        actor_role: Database["public"]["Enums"]["app_role"] | null;
        action: Database["public"]["Enums"]["security_audit_action"];
        resource_type: Database["public"]["Enums"]["security_audit_resource"];
        resource_id: string | null;
        subject_patient_id: string | null;
        outcome: Database["public"]["Enums"]["security_audit_outcome"];
        request_id: string | null;
      };
      Insert: never;
      Update: never;
      Relationships: [];
    };
    Functions: {
      /**
       * Phase 19. Records one privileged access.
       *
       * The actor and their role are derived from `auth.uid()` inside the
       * database and are not parameters, so an entry cannot be attributed to
       * somebody else. It carries no clinical content — there is no column for
       * any — and it never throws: an audit failure must not undo an operation
       * the caller was authorized to perform.
       */
      record_security_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["security_audit_action"];
          p_resource_type: Database["public"]["Enums"]["security_audit_resource"];
          p_outcome: Database["public"]["Enums"]["security_audit_outcome"];
          p_resource_id?: string | null;
          p_subject_patient_id?: string | null;
          p_request_id?: string | null;
        };
        Returns: undefined;
      };
      /**
       * Phase 19. The recent audit trail, for administrators only. Raises
       * `insufficient_privilege` for every other caller, and bounds its own
       * result rather than letting the caller choose.
       */
      security_audit_recent: {
        Args: { p_limit?: number };
        Returns: {
          occurred_at: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          action: Database["public"]["Enums"]["security_audit_action"];
          resource_type: Database["public"]["Enums"]["security_audit_resource"];
          resource_id: string | null;
          subject_patient_id: string | null;
          outcome: Database["public"]["Enums"]["security_audit_outcome"];
        }[];
      };
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"] | null;
      };
      has_app_role: {
        Args: { target: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      /**
       * The only way to assign a role. Authorizes the caller as an admin,
       * refuses a caller acting on their own account, validates the target and
       * writes an audit row — all inside the database, so the check holds
       * whatever the calling code does.
       */
      assign_user_role: {
        Args: {
          target_user_id: string;
          new_role: Database["public"]["Enums"]["app_role"];
        };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      /**
       * The administrator's access-management list. Raises unless the caller
       * is an admin. Returns the minimum an access screen needs and no patient
       * information at all.
       */
      list_managed_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          user_id: string;
          email: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          email_confirmed: boolean;
          created_at: string;
        }[];
      };
      /** The clinic scheduling timezone, so SQL and TypeScript cannot drift. */
      clinic_timezone: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      /**
       * The provisional booking rules. The database is the authority; the
       * mirror in `src/config/appointments.ts` exists so the browser can grey
       * out a date rather than let someone pick it and be refused.
       */
      appointment_booking_rules: {
        Args: Record<PropertyKey, never>;
        Returns: {
          min_notice_minutes: number;
          max_horizon_days: number;
          slot_interval_minutes: number;
          cancellation_cutoff_minutes: number;
          max_active_per_patient: number;
        }[];
      };
      /** The caller's own patient record id. Takes no argument, deliberately. */
      current_patient_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      /**
       * The caller's own practitioner record id, or null.
       *
       * Exists so the doctor's-diary policy can scope by relationship without
       * the caller needing a grant on `practitioners.profile_id`, which no
       * client holds. Phase 11's workspace also reads it directly, to tell a
       * doctor whose account is not on the scheduling roster why they have no
       * diary.
       */
      current_practitioner_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      /**
       * Whether the calling practitioner has an appointment with this patient
       * (Phase 11).
       *
       * The whole of the doctor patient-access policy, and the predicate the
       * `patients_select_doctor_care` policy is built on. Answers only about
       * the caller's own practitioner record.
       */
      doctor_has_care_relationship: {
        Args: { p_patient_id: string };
        Returns: boolean;
      };
      /** Whether this appointment is in the calling practitioner's diary. */
      doctor_owns_appointment: {
        Args: { p_appointment_id: string };
        Returns: boolean;
      };
      /**
       * Bounded patient search restricted to the caller's own care scope
       * (Phase 11).
       *
       * Refuses a caller who is not a doctor with a practitioner record,
       * returns nothing below two characters, clamps its own limit, and
       * discloses no address, emergency contact or account identifier.
       */
      search_care_patients: {
        Args: { p_query: string; p_limit?: number };
        Returns: {
          id: string;
          full_name: string;
          preferred_name: string | null;
          phone: string | null;
          date_of_birth: string | null;
          last_appointment_at: string | null;
        }[];
      };
      /**
       * The practitioner's own operational status actions (Phase 11).
       *
       * Note the argument list: no practitioner id, and no reason. The
       * practitioner is derived from `auth.uid()`, and the four transitions
       * this function permits write no free text. It refuses `cancelled`, and
       * it acts only on appointments in the caller's own diary.
       */
      update_appointment_status_as_doctor: {
        Args: {
          p_appointment_id: string;
          p_status: Database["public"]["Enums"]["appointment_status"];
        };
        Returns: undefined;
      };
      /**
       * Interval boundaries for the availability snapshot.
       *
       * Discloses no appointment id, no patient, no status and no blocked
       * period reason — only when the practitioner is unavailable, which is
       * what the slot list about to be rendered says anyway.
       */
      get_practitioner_busy_intervals: {
        Args: {
          p_practitioner_id: string;
          p_from: string;
          p_to: string;
        };
        Returns: { busy_start: string; busy_end: string }[];
      };
      /**
       * The only way a patient creates an appointment.
       *
       * Note the argument list: no patient id, no duration, no end time, no
       * status, no timestamps. Those are derived inside the function, which is
       * why a manipulated request has nothing to act on.
       */
      book_appointment: {
        Args: {
          p_practitioner_id: string;
          p_appointment_type_id: string;
          p_starts_at: string;
          p_patient_note?: string | null;
        };
        Returns: string;
      };
      /** Sets status to cancelled and records who and when. Never a delete. */
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      /** Moves an appointment in place, re-validating and re-recording history. */
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string };
        Returns: undefined;
      };
      /**
       * Bounded operational patient search for the front desk (Phase 10).
       *
       * Refuses a caller who is not a receptionist, returns nothing for a
       * query shorter than two characters, clamps its own limit, and discloses
       * the minimum needed to identify a person — no address, no emergency
       * contact and no account identifier.
       */
      search_patients: {
        Args: { p_query: string; p_limit?: number };
        Returns: {
          id: string;
          full_name: string;
          preferred_name: string | null;
          phone: string | null;
          date_of_birth: string | null;
          city: string | null;
          has_account: boolean;
        }[];
      };
      /**
       * Candidate existing records for a patient about to be created.
       *
       * Advisory only: it merges nothing and blocks nothing
       * (`phase_10.md` section 33).
       */
      find_possible_duplicate_patients: {
        Args: {
          p_full_name: string;
          p_phone?: string | null;
          p_date_of_birth?: string | null;
        };
        Returns: {
          id: string;
          full_name: string;
          preferred_name: string | null;
          phone: string | null;
          date_of_birth: string | null;
          city: string | null;
          has_account: boolean;
          match_reason: string;
        }[];
      };
      /**
       * Creates an **unlinked** patient record for a walk-in.
       *
       * Note the argument list: there is no owner parameter, so a receptionist
       * cannot attach a record to an account. It creates no authentication
       * account and no credential (`phase_10.md` sections 34-35).
       */
      create_patient_record: {
        Args: {
          p_full_name: string;
          p_preferred_name?: string | null;
          p_phone?: string | null;
          p_date_of_birth?: string | null;
          p_gender?: string | null;
          p_address_line1?: string | null;
          p_address_line2?: string | null;
          p_city?: string | null;
          p_state?: string | null;
          p_postal_code?: string | null;
          p_emergency_contact_name?: string | null;
          p_emergency_contact_relationship?: string | null;
          p_emergency_contact_phone?: string | null;
          p_preferred_language?: string | null;
        };
        Returns: string;
      };
      /**
       * Books on a patient's behalf.
       *
       * The patient id is the one identifier a staff write takes, because the
       * receptionist selects the patient — and it is validated against the
       * patients table before anything is written (`phase_10.md` section 18).
       * The duration, end, blocked-until and status are still derived, and are
       * still not parameters.
       */
      create_appointment_for_patient: {
        Args: {
          p_patient_id: string;
          p_practitioner_id: string;
          p_appointment_type_id: string;
          p_starts_at: string;
          p_patient_note?: string | null;
        };
        Returns: string;
      };
      /**
       * The front desk's operational status actions.
       *
       * Refuses `completed` and `in_consultation` for this role, and defers to
       * the Phase 09 transition trigger for legality.
       */
      update_appointment_status_as_staff: {
        Args: {
          p_appointment_id: string;
          p_status: Database["public"]["Enums"]["appointment_status"];
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      /** Moves an appointment on a patient's behalf, preserving its status. */
      reschedule_appointment_as_staff: {
        Args: { p_appointment_id: string; p_starts_at: string };
        Returns: undefined;
      };
      /**
       * Opens the clinical record for one of the caller's own appointments
       * (Phase 12).
       *
       * Note the argument list: **one appointment id**. There is no patient,
       * no practitioner and no status — all three are derived from the
       * appointment inside the database, after the caller's own practitioner
       * record has been resolved from `auth.uid()`. Idempotent: a second call
       * returns the id of the record the first one created.
       */
      start_consultation: {
        Args: { p_appointment_id: string };
        Returns: string;
      };
      /**
       * Saves draft clinical content, and returns the new version.
       *
       * The argument list is the allowlist: a record id, the version being
       * edited, and the eight clinical fields. No status, no patient, no
       * practitioner, no appointment, no timestamp.
       */
      save_clinical_draft: {
        Args: {
          p_record_id: string;
          p_expected_version: number;
          p_chief_complaint: string;
          p_history_of_presenting_concern: string;
          p_symptoms: string;
          p_clinical_observations: string;
          p_assessment: string;
          p_diagnosis_or_clinical_impression: string;
          p_doctor_notes: string;
          p_follow_up_notes: string;
        };
        Returns: number;
      };
      /**
       * Validates, saves and closes a consultation, completing the
       * appointment in the same transaction.
       *
       * The only path to the `completed` status — there is no status
       * parameter here or anywhere else in the feature.
       */
      complete_clinical_record: {
        Args: {
          p_record_id: string;
          p_expected_version: number;
          p_chief_complaint: string;
          p_history_of_presenting_concern: string;
          p_symptoms: string;
          p_clinical_observations: string;
          p_assessment: string;
          p_diagnosis_or_clinical_impression: string;
          p_doctor_notes: string;
          p_follow_up_notes: string;
        };
        Returns: number;
      };
      /**
       * Opens a draft prescription against one of the caller's own
       * consultations (Phase 13).
       *
       * **One clinical record id.** The patient, the practitioner and the
       * appointment are all read out of that record inside the database,
       * after the caller's own practitioner record has been resolved from
       * `auth.uid()`. Idempotent: a second call returns the existing draft.
       */
      create_prescription: {
        Args: { p_clinical_record_id: string };
        Returns: string;
      };
      /**
       * Saves prescription content and replaces its items atomically,
       * returning the new revision.
       *
       * The argument list is the allowlist: a prescription id, the revision
       * being edited, the general instructions and the items. No status, no
       * patient, no practitioner, no appointment, no timestamp.
       */
      save_prescription_draft: {
        Args: {
          p_prescription_id: string;
          p_expected_version: number;
          p_general_instructions: string;
          p_items: Json;
        };
        Returns: number;
      };
      /**
       * The only path to the `issued` status.
       *
       * Takes **no clinical content**, so the act of issuing cannot change
       * what is issued — the doctor reviews what is saved and issues exactly
       * that.
       */
      issue_prescription: {
        Args: { p_prescription_id: string; p_expected_version: number };
        Returns: number;
      };
      /** Withdraws a prescription by status, never by deletion. */
      cancel_prescription: {
        Args: {
          p_prescription_id: string;
          p_expected_version: number;
          p_reason?: string | null;
        };
        Returns: number;
      };
      /** Opens a draft treatment plan against one of the caller's own consultations. */
      create_treatment_plan: {
        Args: { p_clinical_record_id: string };
        Returns: string;
      };
      /**
       * Saves treatment plan content and replaces its items atomically.
       *
       * Writes no appointment: a follow-up date is a note to the patient, not
       * a booking (`phase_13.md` section 47).
       */
      save_treatment_plan_draft: {
        Args: {
          p_treatment_plan_id: string;
          p_expected_version: number;
          p_title: string;
          p_summary: string;
          p_start_date: string | null;
          p_follow_up_on: string | null;
          p_items: Json;
        };
        Returns: number;
      };
      /** The only path to `active`, and therefore to patient visibility. */
      activate_treatment_plan: {
        Args: { p_treatment_plan_id: string; p_expected_version: number };
        Returns: number;
      };
      complete_treatment_plan: {
        Args: { p_treatment_plan_id: string; p_expected_version: number };
        Returns: number;
      };
      cancel_treatment_plan: {
        Args: { p_treatment_plan_id: string; p_expected_version: number };
        Returns: number;
      };
      /**
       * Prefix suggestions drawn from the calling practitioner's own
       * prescribing history.
       *
       * Not a catalog and not a recommendation. Discloses one name and the
       * form last used with it — no patient, no date, no dose.
       */
      search_prescribed_medicines: {
        Args: { p_query: string; p_limit?: number };
        Returns: { medicine_name: string; form: string | null }[];
      };
      /**
       * Records a document the signed-in patient uploaded for themselves
       * (Phase 14).
       *
       * Note the argument list: **no patient id**. The patient is derived
       * from the session inside the database, and the storage path is
       * recomputed from that patient, the document id and the validated MIME
       * type and compared with what the caller says it wrote — so a path is
       * checked rather than trusted. Idempotent on the document id.
       */
      create_patient_document_as_patient: {
        Args: {
          p_document_id: string;
          p_document_type: Database["public"]["Enums"]["patient_document_type"];
          p_title: string;
          p_description: string | null;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_file_size: number;
          p_checksum: string;
        };
        Returns: string;
      };
      /**
       * Records a document a practitioner uploaded from one of their own
       * appointments.
       *
       * **One appointment id.** The patient, the practitioner and the
       * consultation are all read out of that appointment, which is resolved
       * by the caller's own practitioner record — there is no patient,
       * practitioner or clinical record parameter.
       */
      create_patient_document_as_practitioner: {
        Args: {
          p_appointment_id: string;
          p_document_id: string;
          p_document_type: Database["public"]["Enums"]["patient_document_type"];
          p_title: string;
          p_description: string | null;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_file_size: number;
          p_checksum: string;
        };
        Returns: string;
      };
      /**
       * Withdraws a document from the working record. A status change, never
       * a delete, and only the account that uploaded it may perform it.
       */
      archive_patient_document: {
        Args: { p_document_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      /**
       * The canonical object key for a document.
       *
       * Declared for completeness and parity with the TypeScript builder in
       * `lib/documents/storage-path.ts`; it is not granted to any client
       * role, so nothing in the application calls it.
       */
      patient_document_storage_path: {
        Args: {
          p_patient_id: string;
          p_document_id: string;
          p_mime_type: string;
        };
        Returns: string | null;
      };

      /* ---------------------------------------------------------------
       * Phase 15 — notifications.
       *
       * Three groups, and the grants are the interesting part:
       *
       *   * configuration, executable by `authenticated`;
       *   * read state and preferences, executable by `authenticated` and
       *     scoped by `auth.uid()` with **no user id parameter**;
       *   * the processor's interface, executable by `service_role` alone,
       *     so no signed-in user can create a notification, claim an event
       *     or record a delivery result.
       * --------------------------------------------------------------- */

      /** Minutes before an appointment at which a reminder is due. */
      notification_reminder_offsets: {
        Args: Record<PropertyKey, never>;
        Returns: number[];
      };
      /** Whether a category's in-app channel may be switched off. */
      notification_category_is_mandatory: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"];
        };
        Returns: boolean;
      };
      /**
       * The application route a notification points at. Derived, not stored.
       *
       * Null where that audience has no route for that resource — a
       * practitioner is not told about a prescription they wrote themselves.
       */
      notification_link_path: {
        Args: {
          p_audience: Database["public"]["Enums"]["notification_audience"];
          p_resource_type: Database["public"]["Enums"]["notification_subject_type"];
          p_resource_id: string;
        };
        Returns: string | null;
      };

      /**
       * Marks one of the calling user's own notifications read. Somebody
       * else's matches no rows, which is the same answer as one that does
       * not exist.
       */
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: boolean;
      };
      /** Marks every unread notification of the calling user read. */
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      /**
       * Changes the calling user's own preference. **No user id parameter**,
       * so `{"userId": "another-user"}` has nowhere to arrive. Refuses to
       * disable the in-app channel of a mandatory transactional category.
       */
      set_notification_preference: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"];
          p_channel: Database["public"]["Enums"]["notification_channel"];
          p_enabled: boolean;
        };
        Returns: boolean;
      };

      /** Authoritative appointment state for a template. No notes, ever. */
      notification_appointment_context: {
        Args: { p_appointment_id: string };
        Returns: {
          status: Database["public"]["Enums"]["appointment_status"];
          starts_at: string;
          ends_at: string;
          practitioner_name: string;
          appointment_type_name: string;
        }[];
      };
      /** Whether a prescription is issued. No items, no medicine, no dose. */
      notification_prescription_context: {
        Args: { p_prescription_id: string };
        Returns: {
          status: Database["public"]["Enums"]["prescription_status"];
          issued_at: string | null;
          practitioner_name: string;
        }[];
      };
      /** Whether a plan is active. No title, no summary, no items. */
      notification_treatment_plan_context: {
        Args: { p_plan_id: string };
        Returns: {
          status: Database["public"]["Enums"]["treatment_plan_status"];
          activated_at: string | null;
          practitioner_name: string;
        }[];
      };

      /**
       * The only way a notification is created. Resolves the recipient and
       * the deep link from the audience and the resource — **neither is a
       * parameter** — and is idempotent on `p_dedupe_key`.
       *
       * `p_audience` is not a recipient: it is `patient` or `practitioner`,
       * and neither value names anybody.
       */
      create_notification: {
        Args: {
          p_dedupe_key: string;
          p_audience: Database["public"]["Enums"]["notification_audience"];
          p_event_type: Database["public"]["Enums"]["notification_event_type"];
          p_category: Database["public"]["Enums"]["notification_category"];
          p_resource_type: Database["public"]["Enums"]["notification_subject_type"];
          p_resource_id: string;
          p_title: string;
          p_body: string;
          p_template_version: number;
          p_status?: Database["public"]["Enums"]["notification_status"];
          p_scheduled_for?: string | null;
          p_reminder_offset_minutes?: number | null;
        };
        Returns: string;
      };

      /**
       * Cancels every scheduled reminder the appointment no longer justifies
       * and returns the set it does. The offsets are configuration, not a
       * parameter.
       */
      plan_appointment_reminders: {
        Args: { p_appointment_id: string };
        Returns: {
          offset_minutes: number;
          scheduled_for: string;
          dedupe_key: string;
        }[];
      };
      cancel_appointment_reminders: {
        Args: { p_appointment_id: string };
        Returns: number;
      };
      /**
       * Releases reminders whose time has come and whose appointment still
       * justifies them; cancels the rest. Re-reads the authoritative
       * appointment rather than trusting the scheduled row.
       */
      release_due_reminders: {
        Args: { p_limit?: number };
        Returns: { notification_id: string; released: boolean }[];
      };

      claim_notification_outbox: {
        Args: { p_limit?: number; p_lease_seconds?: number };
        Returns: {
          id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          subject_type: Database["public"]["Enums"]["notification_subject_type"];
          subject_id: string;
          dedupe_key: string;
          attempt_count: number;
          occurred_at: string;
        }[];
      };
      complete_notification_outbox: {
        Args: {
          p_id: string;
          p_status: Database["public"]["Enums"]["notification_outbox_status"];
          p_error_code?: string | null;
          p_retry_at?: string | null;
        };
        Returns: undefined;
      };
      enqueue_notification_delivery: {
        Args: {
          p_notification_id: string;
          p_channel: Database["public"]["Enums"]["notification_channel"];
          p_provider: string;
        };
        Returns: string | null;
      };
      /**
       * Leases due external deliveries, skipping those the patient has
       * switched off and those with no confirmed contact. The recipient
       * address is returned for one send and is never stored in this schema.
       */
      claim_notification_deliveries: {
        Args: { p_limit?: number; p_lease_seconds?: number };
        Returns: {
          delivery_id: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          provider: string;
          attempt_count: number;
          notification_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          category: Database["public"]["Enums"]["notification_category"];
          title: string;
          body: string;
          link_path: string;
          recipient_email: string;
        }[];
      };
      record_notification_delivery_result: {
        Args: {
          p_delivery_id: string;
          p_status: Database["public"]["Enums"]["notification_delivery_status"];
          p_provider_message_id?: string | null;
          p_error_code?: string | null;
          p_retry_at?: string | null;
        };
        Returns: undefined;
      };

      /*
       * Phase 16 — analytics.
       *
       * Only the **public** interface is declared. The internal helpers
       * (`analytics_appointment_counts`, `analytics_utilization`,
       * `analytics_range_rules` and the three gates) are absent on purpose:
       * no client role may execute them, so a call from the application
       * should not type-check either. The same reasoning that types a
       * write-forbidden table's `Insert` as `never`.
       *
       * Every argument list below is the whole of what a caller may send.
       * Note in particular that the `analytics_practice_*` functions take no
       * practitioner id — the scope is resolved from the session inside the
       * database — and that nothing here takes a patient id, a clinic id or
       * a column name.
       */

      /** Appointment counts for the clinic, optionally one practitioner. */
      analytics_clinic_appointment_summary: {
        Args: {
          p_from: string;
          p_to: string;
          p_practitioner_id?: string | null;
        };
        Returns: {
          total: number;
          requested: number;
          confirmed: number;
          checked_in: number;
          in_consultation: number;
          completed: number;
          cancelled: number;
          no_show: number;
          eligible: number;
        }[];
      };
      /** One row per trend bucket, empty buckets included as zeroes. */
      analytics_clinic_appointment_trend: {
        Args: {
          p_from: string;
          p_to: string;
          p_practitioner_id?: string | null;
        };
        Returns: {
          bucket_start: string;
          total: number;
          completed: number;
          cancelled: number;
          no_show: number;
        }[];
      };
      /** Operational workload per practitioner. Nothing clinical. */
      analytics_clinic_practitioner_workload: {
        Args: { p_from: string; p_to: string };
        Returns: {
          practitioner_id: string;
          display_name: string;
          is_active: boolean;
          total: number;
          completed: number;
          cancelled: number;
          no_show: number;
          eligible: number;
          booked_minutes: number;
          available_minutes: number;
        }[];
      };
      analytics_clinic_patient_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          new_patients: number;
          returning_patients: number;
          active_patients: number;
          total_patients: number;
        }[];
      };
      analytics_clinic_patient_growth: {
        Args: { p_from: string; p_to: string };
        Returns: { bucket_start: string; new_patients: number }[];
      };
      /**
       * External send attempts. Note the absence of a `delivered` count:
       * Phase 15 records `sent` to mean the provider accepted the request,
       * and no configured provider confirms delivery.
       */
      analytics_notification_delivery_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"];
          provider: string;
          pending: number;
          sent: number;
          failed: number;
          skipped: number;
        }[];
      };
      analytics_notification_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          category: Database["public"]["Enums"]["notification_category"];
          scheduled: number;
          active: number;
          cancelled: number;
          read_count: number;
        }[];
      };
      /** Counts of clinical acts. No clinical content is reachable. */
      analytics_clinical_activity_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          prescriptions_issued: number;
          treatment_plans_activated: number;
          consultations_documented: number;
          documents_uploaded: number;
        }[];
      };
      analytics_document_type_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          document_type: Database["public"]["Enums"]["patient_document_type"];
          uploaded: number;
        }[];
      };
      /** The caller's own practice. **No practitioner argument.** */
      analytics_practice_appointment_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          total: number;
          requested: number;
          confirmed: number;
          checked_in: number;
          in_consultation: number;
          completed: number;
          cancelled: number;
          no_show: number;
          eligible: number;
        }[];
      };
      analytics_practice_appointment_trend: {
        Args: { p_from: string; p_to: string };
        Returns: {
          bucket_start: string;
          total: number;
          completed: number;
          cancelled: number;
          no_show: number;
        }[];
      };
      analytics_practice_utilization: {
        Args: { p_from: string; p_to: string };
        Returns: { booked_minutes: number; available_minutes: number }[];
      };
      /**
       * The one exportable report. Aggregated counts, so there is no patient
       * identifier in the return type to leave out.
       */
      analytics_appointment_report: {
        Args: {
          p_from: string;
          p_to: string;
          p_practitioner_id?: string | null;
        };
        Returns: {
          clinic_date: string;
          practitioner_name: string;
          appointment_type_name: string;
          status: Database["public"]["Enums"]["appointment_status"];
          appointment_count: number;
        }[];
      };

      /*
       * -------------------------------------------------------------------
       * Phase 17 — clinical AI
       * -------------------------------------------------------------------
       *
       * Note what none of these takes: a patient id, a practitioner id, a
       * doctor id, a model override, a temperature, a prompt or a system
       * prompt. The practitioner is resolved from `auth.uid()` by
       * `assert_care_practitioner()`, the patient is read out of the
       * appointment, and the model and prompt come from frozen application
       * tables (`phase_17.md` sections 8, 93).
       *
       * The trigger function and the two internal helpers are deliberately
       * **not** declared, exactly as Phase 16 left its internal analytics
       * functions out: calling one from the application should not type-check
       * either.
       */

      /** The quota, for the panel. Three constants, no data. */
      ai_assistance_limits: {
        Args: Record<PropertyKey, never>;
        Returns: {
          window_minutes: number;
          max_per_practitioner: number;
          max_per_patient: number;
        }[];
      };
      /**
       * Consumes quota and writes the audit entry **before** the provider is
       * called, and hands back the scope it derived.
       */
      start_ai_assistance_session: {
        Args: {
          p_appointment_id: string;
          p_task: Database["public"]["Enums"]["ai_assistance_task"];
          p_prompt_version: string;
          p_provider: string;
          p_model: string;
          p_context_fingerprint: string;
        };
        Returns: {
          session_id: string;
          resolved_patient_id: string;
          resolved_clinical_record_id: string | null;
        }[];
      };
      /** Records how it ended. Metrics only — no parameter for clinical text. */
      complete_ai_assistance_session: {
        Args: {
          p_session_id: string;
          p_status: Database["public"]["Enums"]["ai_assistance_status"];
          p_failure_code?: string | null;
          p_latency_ms?: number | null;
          p_input_tokens?: number | null;
          p_output_tokens?: number | null;
        };
        Returns: void;
      };
      /** The caller's own usage. No practitioner parameter, no patient column. */
      ai_assistance_usage: {
        Args: Record<PropertyKey, never>;
        Returns: {
          used: number;
          allowed: number;
          window_minutes: number;
        }[];
      };
      /**
       * Aggregate AI operational metrics for Phase 16.
       *
       * No prompt, no response, no patient and — section 108 — **no
       * practitioner dimension**, so a per-doctor acceptance ranking cannot be
       * computed from it at all.
       */
      analytics_ai_assistance_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          task: Database["public"]["Enums"]["ai_assistance_task"];
          status: Database["public"]["Enums"]["ai_assistance_status"];
          sessions: number;
          total_input_tokens: number;
          total_output_tokens: number;
          avg_latency_ms: number;
        }[];
      };
    };
    Enums: {
      app_role: "patient" | "receptionist" | "doctor" | "admin";
      /** Phase 19. What kind of privileged access an audit entry records. */
      security_audit_action:
        | "clinical_record.read"
        | "prescription.read"
        | "treatment_plan.read"
        | "patient_record.read"
        | "document.access_granted"
        | "report.exported"
        | "authorization.denied";
      /** Phase 19. What the access was against. */
      security_audit_resource:
        | "clinical_record"
        | "prescription"
        | "treatment_plan"
        | "patient"
        | "document"
        | "report"
        | "route";
      /** Phase 19. Whether the access happened. */
      security_audit_outcome: "allowed" | "denied";
      appointment_status:
        | "requested"
        | "confirmed"
        | "checked_in"
        | "in_consultation"
        | "completed"
        | "cancelled"
        | "no_show";
      appointment_event_type: "created" | "status_changed" | "rescheduled";
      /**
       * The clinical record lifecycle (Phase 12).
       *
       * `amended` is declared and unreachable: the transition trigger permits
       * `completed -> amended` and no function in the migration sets it. It
       * exists now because PostgreSQL will not let a value added by
       * `alter type ... add value` be used in the same transaction, and
       * Supabase applies each migration in one — so a later phase that adds
       * and uses it in a single migration would fail.
       */
      clinical_record_status: "draft" | "completed" | "amended";
      /**
       * The prescription lifecycle (Phase 13).
       *
       * `amended` is declared and unreachable, for the reason above: no
       * function in the migration sets it, and a test asserts that. It exists
       * so the formal amendment workflow can arrive without an enum change in
       * the same transaction that first uses the value.
       */
      prescription_status: "draft" | "issued" | "cancelled" | "amended";
      /** The treatment plan lifecycle (Phase 13). All four are reachable. */
      treatment_plan_status: "draft" | "active" | "completed" | "cancelled";
      /**
       * The structured sections of a treatment plan (Phase 13).
       *
       * `medication` is deliberately absent — that is a prescription, which
       * has its own table, its own immutability rules and its own patient
       * visibility.
       */
      treatment_plan_category:
        "diet" | "lifestyle" | "therapy" | "follow_up" | "other";
      /**
       * What kind of document this is (Phase 14).
       *
       * Chosen by whoever uploaded it, never inferred from the file.
       * `previous_prescription` is a scan of somebody else's prescription
       * that the patient brought in — deliberately not called `prescription`,
       * because a Punarvasu prescription is a row in its own table and not a
       * file.
       */
      patient_document_type:
        | "lab_report"
        | "diagnostic_report"
        | "medical_image"
        | "previous_prescription"
        | "referral"
        | "previous_record"
        | "other";
      /**
       * A document is never deleted. Archiving withdraws it from the working
       * record while preserving the metadata, the object and the reason.
       */
      patient_document_status: "active" | "archived";
      /**
       * Which side of the consultation supplied the document. Deliberately
       * not `app_role`: a new role must not become an uploader by accident.
       */
      patient_document_uploader: "patient" | "practitioner";
      /**
       * The domain events this system communicates (Phase 15).
       *
       * Every value is produced by a trigger or by the reminder planner.
       * `appointment_created` is absent on purpose: a patient's request is
       * not yet an agreement.
       */
      notification_event_type:
        | "appointment_confirmed"
        | "appointment_rescheduled"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "prescription_issued"
        | "treatment_plan_activated";
      /**
       * The closed set of doctor-facing AI tasks (Phase 17).
       *
       * A closed set in the database as well as in `config/clinical-ai.ts`, so
       * "no generic AI endpoint" is a property of the schema and not only of a
       * route handler. `document_summary` is deliberately absent: Phase 14
       * stores no text extracted from a file, so there would be nothing to
       * summarise.
       */
      ai_assistance_task:
        | "clinical_summary"
        | "missing_information"
        | "clinical_considerations"
        | "consultation_summary";
      /**
       * How an AI invocation ended (Phase 17).
       *
       * `rejected` means the provider answered and **our own safety layer**
       * refused the answer. It is neither a provider failure nor a success,
       * and keeping it distinct is what makes "how often is the model drifting
       * outside the boundary?" a question with an answer.
       */
      ai_assistance_status: "pending" | "succeeded" | "failed" | "rejected";
      /** What a notification is about, and what its deep link resolves to. */
      notification_subject_type:
        "appointment" | "prescription" | "treatment_plan";
      /**
       * Which side of an appointment a notification was written for.
       *
       * Two, because two exist. There is no `receptionist` and no
       * `administrator`: no workflow has been designed for either, and an
       * enum value nothing can produce is the pretence `phase_15.md` section
       * 14 forbids.
       */
      notification_audience: "patient" | "practitioner";
      /**
       * The preference unit. `appointment_updates` and `clinical_updates` are
       * mandatory transactional communication whose in-app channel cannot be
       * switched off; `appointment_reminders` is optional.
       */
      notification_category:
        "appointment_updates" | "appointment_reminders" | "clinical_updates";
      /**
       * Two, because two are real.
       *
       * There is deliberately no `sms` and no `whatsapp`: no provider is
       * configured for either, and an enum value nothing can produce is the
       * pretence `phase_15.md` section 14 forbids. Adding one is two
       * migrations, for the `alter type ... add value` reason recorded
       * against the Phase 09, 12 and 13 enums.
       */
      notification_channel: "in_app" | "email";
      /**
       * `scheduled` is a reminder whose time has not come, and it is
       * invisible to the patient because `notifications_select_own` carries
       * `status = 'active'` — a predicate on the row, not a filter a query
       * could forget.
       */
      notification_status: "scheduled" | "active" | "cancelled";
      notification_outbox_status:
        "pending" | "processing" | "processed" | "failed" | "skipped";
      /**
       * `sent` means the provider accepted the request, which is the
       * strongest claim any configured provider supports. There is
       * deliberately no `delivered`: nothing configured here reports delivery
       * confirmation, and a status nothing can set is one somebody will one
       * day read as true.
       */
      notification_delivery_status: "pending" | "sent" | "failed" | "skipped";
    };
    CompositeTypes: Record<never, never>;
  };
}
