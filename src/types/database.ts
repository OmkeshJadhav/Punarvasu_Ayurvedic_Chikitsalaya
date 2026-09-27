export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_assistance_sessions: {
        Row: {
          appointment_id: string
          clinical_record_id: string | null
          completed_at: string | null
          context_fingerprint: string
          created_at: string
          created_by: string | null
          failure_code: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          patient_id: string
          practitioner_id: string
          prompt_version: string
          provider: string
          status: Database["public"]["Enums"]["ai_assistance_status"]
          task: Database["public"]["Enums"]["ai_assistance_task"]
        }
        Insert: {
          appointment_id: string
          clinical_record_id?: string | null
          completed_at?: string | null
          context_fingerprint: string
          created_at?: string
          created_by?: string | null
          failure_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          patient_id: string
          practitioner_id: string
          prompt_version: string
          provider: string
          status?: Database["public"]["Enums"]["ai_assistance_status"]
          task: Database["public"]["Enums"]["ai_assistance_task"]
        }
        Update: {
          appointment_id?: string
          clinical_record_id?: string | null
          completed_at?: string | null
          context_fingerprint?: string
          created_at?: string
          created_by?: string | null
          failure_code?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          patient_id?: string
          practitioner_id?: string
          prompt_version?: string
          provider?: string
          status?: Database["public"]["Enums"]["ai_assistance_status"]
          task?: Database["public"]["Enums"]["ai_assistance_task"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistance_sessions_appointment_consistency"
            columns: ["appointment_id", "patient_id", "practitioner_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "patient_id", "practitioner_id"]
          },
          {
            foreignKeyName: "ai_assistance_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistance_sessions_clinical_record_id_fkey"
            columns: ["clinical_record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistance_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistance_sessions_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistance_sessions_record_consistency"
            columns: ["clinical_record_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id", "patient_id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          actor_id: string | null
          appointment_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id: string
          new_ends_at: string | null
          new_starts_at: string | null
          new_status: Database["public"]["Enums"]["appointment_status"] | null
          previous_ends_at: string | null
          previous_starts_at: string | null
          previous_status:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          new_ends_at?: string | null
          new_starts_at?: string | null
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_ends_at?: string | null
          previous_starts_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["appointment_event_type"]
          id?: string
          new_ends_at?: string | null
          new_starts_at?: string | null
          new_status?: Database["public"]["Enums"]["appointment_status"] | null
          previous_ends_at?: string | null
          previous_starts_at?: string | null
          previous_status?:
            | Database["public"]["Enums"]["appointment_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_types: {
        Row: {
          buffer_minutes: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_type_id: string
          blocked_until: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          internal_note: string | null
          patient_id: string
          patient_note: string | null
          practitioner_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type_id: string
          blocked_until: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          internal_note?: string | null
          patient_id: string
          patient_note?: string | null
          practitioner_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type_id?: string
          blocked_until?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          internal_note?: string | null
          patient_id?: string
          patient_note?: string | null
          practitioner_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_records: {
        Row: {
          appointment_id: string
          assessment: string | null
          chief_complaint: string | null
          clinical_observations: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          diagnosis_or_clinical_impression: string | null
          doctor_notes: string | null
          follow_up_notes: string | null
          history_of_presenting_concern: string | null
          id: string
          patient_id: string
          practitioner_id: string
          status: Database["public"]["Enums"]["clinical_record_status"]
          symptoms: string | null
          updated_at: string
          version: number
        }
        Insert: {
          appointment_id: string
          assessment?: string | null
          chief_complaint?: string | null
          clinical_observations?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis_or_clinical_impression?: string | null
          doctor_notes?: string | null
          follow_up_notes?: string | null
          history_of_presenting_concern?: string | null
          id?: string
          patient_id: string
          practitioner_id: string
          status?: Database["public"]["Enums"]["clinical_record_status"]
          symptoms?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          appointment_id?: string
          assessment?: string | null
          chief_complaint?: string | null
          clinical_observations?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis_or_clinical_impression?: string | null
          doctor_notes?: string | null
          follow_up_notes?: string | null
          history_of_presenting_concern?: string | null
          id?: string
          patient_id?: string
          practitioner_id?: string
          status?: Database["public"]["Enums"]["clinical_record_status"]
          symptoms?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_records_appointment_consistency"
            columns: ["appointment_id", "patient_id", "practitioner_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "patient_id", "practitioner_id"]
          },
          {
            foreignKeyName: "clinical_records_patient_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_practitioner_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempt_count: number
          available_at: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_code: string | null
          failed_at: string | null
          id: string
          last_attempt_at: string | null
          notification_id: string
          provider: string
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_code?: string | null
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id: string
          provider: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_code?: string | null
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id?: string
          provider?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          created_at: string
          dedupe_key: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          last_error_code: string | null
          occurred_at: string
          processed_at: string | null
          status: Database["public"]["Enums"]["notification_outbox_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["notification_subject_type"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          dedupe_key: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          last_error_code?: string | null
          occurred_at?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["notification_outbox_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["notification_subject_type"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          last_error_code?: string | null
          occurred_at?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["notification_outbox_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["notification_subject_type"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          body: string
          cancelled_at: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          dedupe_key: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          link_path: string
          read_at: string | null
          recipient_user_id: string
          reminder_offset_minutes: number | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["notification_subject_type"]
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_version: number
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body: string
          cancelled_at?: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedupe_key: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          link_path: string
          read_at?: string | null
          recipient_user_id: string
          reminder_offset_minutes?: number | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["notification_subject_type"]
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_version: number
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          body?: string
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedupe_key?: string
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          link_path?: string
          read_at?: string | null
          recipient_user_id?: string
          reminder_offset_minutes?: number | null
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["notification_subject_type"]
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_version?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          appointment_id: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          checksum_sha256: string
          clinical_record_id: string | null
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["patient_document_type"]
          file_name: string
          file_size: number
          id: string
          mime_type: string
          patient_id: string
          status: Database["public"]["Enums"]["patient_document_status"]
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_practitioner_id: string | null
          uploaded_by_role: Database["public"]["Enums"]["patient_document_uploader"]
        }
        Insert: {
          appointment_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          checksum_sha256: string
          clinical_record_id?: string | null
          created_at?: string
          description?: string | null
          document_type: Database["public"]["Enums"]["patient_document_type"]
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          patient_id: string
          status?: Database["public"]["Enums"]["patient_document_status"]
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_practitioner_id?: string | null
          uploaded_by_role: Database["public"]["Enums"]["patient_document_uploader"]
        }
        Update: {
          appointment_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          checksum_sha256?: string
          clinical_record_id?: string | null
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["patient_document_type"]
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["patient_document_status"]
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_practitioner_id?: string | null
          uploaded_by_role?: Database["public"]["Enums"]["patient_document_uploader"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_appointment_consistency"
            columns: ["appointment_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "patient_id"]
          },
          {
            foreignKeyName: "patient_documents_clinical_record_consistency"
            columns: ["clinical_record_id", "patient_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id", "patient_id"]
          },
          {
            foreignKeyName: "patient_documents_patient_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_practitioner_fkey"
            columns: ["uploaded_by_practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          full_name: string
          gender: string | null
          id: string
          phone: string | null
          postal_code: string | null
          preferred_language: string | null
          preferred_name: string | null
          profile_id: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name: string
          gender?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          practitioner_id: string
          starts_at: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          practitioner_id: string
          starts_at: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          practitioner_id?: string
          starts_at?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_availability_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioners: {
        Row: {
          accepts_online_booking: boolean
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          accepts_online_booking?: boolean
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          accepts_online_booking?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          created_at: string
          dose_amount: string | null
          dose_unit: string | null
          duration: string | null
          form: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_name: string
          prescription_id: string
          quantity: string | null
          quantity_unit: string | null
          sort_order: number
          strength: string | null
          timing: string | null
        }
        Insert: {
          created_at?: string
          dose_amount?: string | null
          dose_unit?: string | null
          duration?: string | null
          form?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name: string
          prescription_id: string
          quantity?: string | null
          quantity_unit?: string | null
          sort_order: number
          strength?: string | null
          timing?: string | null
        }
        Update: {
          created_at?: string
          dose_amount?: string | null
          dose_unit?: string | null
          duration?: string | null
          form?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string
          prescription_id?: string
          quantity?: string | null
          quantity_unit?: string | null
          sort_order?: number
          strength?: string | null
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinical_record_id: string
          created_at: string
          created_by: string | null
          general_instructions: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          patient_id: string
          practitioner_id: string
          status: Database["public"]["Enums"]["prescription_status"]
          updated_at: string
          version: number
        }
        Insert: {
          appointment_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinical_record_id: string
          created_at?: string
          created_by?: string | null
          general_instructions?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          patient_id: string
          practitioner_id: string
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          appointment_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinical_record_id?: string
          created_at?: string
          created_by?: string | null
          general_instructions?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          patient_id?: string
          practitioner_id?: string
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinical_record_consistency"
            columns: [
              "clinical_record_id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: [
              "id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ]
          },
          {
            foreignKeyName: "prescriptions_patient_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_practitioner_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_assignment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          practitioner_id: string | null
          reason: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          practitioner_id?: string | null
          reason?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          practitioner_id?: string | null
          reason?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_events: {
        Row: {
          action: Database["public"]["Enums"]["security_audit_action"]
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          id: string
          occurred_at: string
          outcome: Database["public"]["Enums"]["security_audit_outcome"]
          request_id: string | null
          resource_id: string | null
          resource_type: Database["public"]["Enums"]["security_audit_resource"]
          subject_patient_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["security_audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          occurred_at?: string
          outcome: Database["public"]["Enums"]["security_audit_outcome"]
          request_id?: string | null
          resource_id?: string | null
          resource_type: Database["public"]["Enums"]["security_audit_resource"]
          subject_patient_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["security_audit_action"]
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          id?: string
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["security_audit_outcome"]
          request_id?: string | null
          resource_id?: string | null
          resource_type?: Database["public"]["Enums"]["security_audit_resource"]
          subject_patient_id?: string | null
        }
        Relationships: []
      }
      treatment_plan_items: {
        Row: {
          category: Database["public"]["Enums"]["treatment_plan_category"]
          created_at: string
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          sort_order: number
          title: string
          treatment_plan_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["treatment_plan_category"]
          created_at?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          sort_order: number
          title: string
          treatment_plan_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["treatment_plan_category"]
          created_at?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          sort_order?: number
          title?: string
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_items_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          appointment_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          clinical_record_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          follow_up_on: string | null
          id: string
          patient_id: string
          practitioner_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["treatment_plan_status"]
          summary: string | null
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          appointment_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinical_record_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_on?: string | null
          id?: string
          patient_id: string
          practitioner_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          appointment_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinical_record_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          follow_up_on?: string | null
          id?: string
          patient_id?: string
          practitioner_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_appointment_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_clinical_record_consistency"
            columns: [
              "clinical_record_id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: [
              "id",
              "appointment_id",
              "patient_id",
              "practitioner_id",
            ]
          },
          {
            foreignKeyName: "treatment_plans_patient_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_practitioner_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_treatment_plan: {
        Args: { p_expected_version: number; p_treatment_plan_id: string }
        Returns: number
      }
      ai_assistance_limits: {
        Args: never
        Returns: {
          max_per_patient: number
          max_per_practitioner: number
          window_minutes: number
        }[]
      }
      ai_assistance_usage: {
        Args: never
        Returns: {
          allowed: number
          used: number
          window_minutes: number
        }[]
      }
      analytics_ai_assistance_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_latency_ms: number
          sessions: number
          status: Database["public"]["Enums"]["ai_assistance_status"]
          task: Database["public"]["Enums"]["ai_assistance_task"]
          total_input_tokens: number
          total_output_tokens: number
        }[]
      }
      analytics_appointment_buckets: {
        Args: { p_from: string; p_practitioner_id: string; p_to: string }
        Returns: {
          bucket_start: string
          cancelled: number
          completed: number
          no_show: number
          total: number
        }[]
      }
      analytics_appointment_counts: {
        Args: { p_end: string; p_practitioner_id: string; p_start: string }
        Returns: {
          cancelled: number
          checked_in: number
          completed: number
          confirmed: number
          eligible: number
          in_consultation: number
          no_show: number
          requested: number
          total: number
        }[]
      }
      analytics_appointment_report: {
        Args: { p_from: string; p_practitioner_id?: string; p_to: string }
        Returns: {
          appointment_count: number
          appointment_type_name: string
          clinic_date: string
          practitioner_name: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      analytics_assert_range: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      analytics_clinic_appointment_summary: {
        Args: { p_from: string; p_practitioner_id?: string; p_to: string }
        Returns: {
          cancelled: number
          checked_in: number
          completed: number
          confirmed: number
          eligible: number
          in_consultation: number
          no_show: number
          requested: number
          total: number
        }[]
      }
      analytics_clinic_appointment_trend: {
        Args: { p_from: string; p_practitioner_id?: string; p_to: string }
        Returns: {
          bucket_start: string
          cancelled: number
          completed: number
          no_show: number
          total: number
        }[]
      }
      analytics_clinic_patient_growth: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bucket_start: string
          new_patients: number
        }[]
      }
      analytics_clinic_patient_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_patients: number
          new_patients: number
          returning_patients: number
          total_patients: number
        }[]
      }
      analytics_clinic_practitioner_workload: {
        Args: { p_from: string; p_to: string }
        Returns: {
          available_minutes: number
          booked_minutes: number
          cancelled: number
          completed: number
          display_name: string
          eligible: number
          is_active: boolean
          no_show: number
          practitioner_id: string
          total: number
        }[]
      }
      analytics_clinical_activity_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          consultations_documented: number
          documents_uploaded: number
          prescriptions_issued: number
          treatment_plans_activated: number
        }[]
      }
      analytics_document_type_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          document_type: Database["public"]["Enums"]["patient_document_type"]
          uploaded: number
        }[]
      }
      analytics_multirange_minutes: {
        Args: { p_ranges: unknown }
        Returns: number
      }
      analytics_notification_delivery_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"]
          failed: number
          pending: number
          provider: string
          sent: number
          skipped: number
        }[]
      }
      analytics_notification_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active: number
          cancelled: number
          category: Database["public"]["Enums"]["notification_category"]
          read_count: number
          scheduled: number
        }[]
      }
      analytics_practice_appointment_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cancelled: number
          checked_in: number
          completed: number
          confirmed: number
          eligible: number
          in_consultation: number
          no_show: number
          requested: number
          total: number
        }[]
      }
      analytics_practice_appointment_trend: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bucket_start: string
          cancelled: number
          completed: number
          no_show: number
          total: number
        }[]
      }
      analytics_practice_utilization: {
        Args: { p_from: string; p_to: string }
        Returns: {
          available_minutes: number
          booked_minutes: number
        }[]
      }
      analytics_range_end: { Args: { p_to: string }; Returns: string }
      analytics_range_rules: {
        Args: never
        Returns: {
          daily_granularity_max_days: number
          earliest_date: string
          max_range_days: number
          weekly_granularity_max_days: number
        }[]
      }
      analytics_range_start: { Args: { p_from: string }; Returns: string }
      analytics_trend_granularity: {
        Args: { p_from: string; p_to: string }
        Returns: string
      }
      analytics_utilization: {
        Args: { p_from: string; p_practitioner_id: string; p_to: string }
        Returns: {
          available_minutes: number
          booked_minutes: number
          practitioner_id: string
        }[]
      }
      appointment_booking_rules: {
        Args: never
        Returns: {
          cancellation_cutoff_minutes: number
          max_active_per_patient: number
          max_horizon_days: number
          min_notice_minutes: number
          slot_interval_minutes: number
        }[]
      }
      archive_patient_document: {
        Args: { p_document_id: string; p_reason?: string }
        Returns: undefined
      }
      assert_appointment_manager: { Args: never; Returns: undefined }
      assert_bookable_slot: {
        Args: {
          p_blocked_until: string
          p_ends_at: string
          p_min_notice_minutes: number
          p_practitioner_id: string
          p_require_online_booking: boolean
          p_starts_at: string
        }
        Returns: undefined
      }
      assert_care_practitioner: { Args: never; Returns: string }
      assert_clinic_analytics_reader: { Args: never; Returns: undefined }
      assert_document_patient: { Args: never; Returns: string }
      assert_notification_worker: { Args: never; Returns: undefined }
      assert_operational_analytics_reader: { Args: never; Returns: undefined }
      assert_patient_register_reader: { Args: never; Returns: undefined }
      assert_report_exporter: { Args: never; Returns: undefined }
      assign_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      book_appointment: {
        Args: {
          p_appointment_type_id: string
          p_patient_note?: string
          p_practitioner_id: string
          p_starts_at: string
        }
        Returns: string
      }
      can_read_patient_document: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      can_read_patient_document_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: undefined
      }
      cancel_appointment_reminders: {
        Args: { p_appointment_id: string }
        Returns: number
      }
      cancel_prescription: {
        Args: {
          p_expected_version: number
          p_prescription_id: string
          p_reason?: string
        }
        Returns: number
      }
      cancel_treatment_plan: {
        Args: { p_expected_version: number; p_treatment_plan_id: string }
        Returns: number
      }
      claim_notification_deliveries: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          delivery_id: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          link_path: string
          notification_id: string
          provider: string
          recipient_email: string
          title: string
        }[]
      }
      claim_notification_outbox: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          dedupe_key: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          occurred_at: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["notification_subject_type"]
        }[]
      }
      clinic_appointment_register: {
        Args: {
          p_from: string
          p_page?: number
          p_practitioner_id?: string
          p_to: string
        }
        Returns: {
          appointment_id: string
          appointment_type_name: string
          patient_id: string
          patient_name: string
          practitioner_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          total_count: number
        }[]
      }
      clinic_patient_register: {
        Args: { p_from: string; p_page?: number; p_to: string }
        Returns: {
          appointments_in_period: number
          completed_in_period: number
          is_new: boolean
          last_visit_at: string
          patient_id: string
          patient_name: string
          registered_at: string
          total_count: number
        }[]
      }
      clinic_recent_activity: {
        Args: { p_from: string; p_practitioner_id?: string; p_to: string }
        Returns: {
          activity: string
          occurred_at: string
          patient_id: string
          patient_name: string
          practitioner_name: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      clinic_register_audit: {
        Args: { p_patient_ids: string[] }
        Returns: undefined
      }
      clinic_timezone: { Args: never; Returns: string }
      complete_ai_assistance_session: {
        Args: {
          p_failure_code?: string
          p_input_tokens?: number
          p_latency_ms?: number
          p_output_tokens?: number
          p_session_id: string
          p_status: Database["public"]["Enums"]["ai_assistance_status"]
        }
        Returns: undefined
      }
      complete_clinical_record: {
        Args: {
          p_assessment: string
          p_chief_complaint: string
          p_clinical_observations: string
          p_diagnosis_or_clinical_impression: string
          p_doctor_notes: string
          p_expected_version: number
          p_follow_up_notes: string
          p_history_of_presenting_concern: string
          p_record_id: string
          p_symptoms: string
        }
        Returns: number
      }
      complete_notification_outbox: {
        Args: {
          p_error_code?: string
          p_id: string
          p_retry_at?: string
          p_status: Database["public"]["Enums"]["notification_outbox_status"]
        }
        Returns: undefined
      }
      complete_treatment_plan: {
        Args: { p_expected_version: number; p_treatment_plan_id: string }
        Returns: number
      }
      create_appointment_for_patient: {
        Args: {
          p_appointment_type_id: string
          p_patient_id: string
          p_patient_note?: string
          p_practitioner_id: string
          p_starts_at: string
        }
        Returns: string
      }
      create_notification: {
        Args: {
          p_audience: Database["public"]["Enums"]["notification_audience"]
          p_body: string
          p_category: Database["public"]["Enums"]["notification_category"]
          p_dedupe_key: string
          p_event_type: Database["public"]["Enums"]["notification_event_type"]
          p_reminder_offset_minutes?: number
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["notification_subject_type"]
          p_scheduled_for?: string
          p_status?: Database["public"]["Enums"]["notification_status"]
          p_template_version: number
          p_title: string
        }
        Returns: string
      }
      create_patient_document_as_patient: {
        Args: {
          p_checksum: string
          p_description: string
          p_document_id: string
          p_document_type: Database["public"]["Enums"]["patient_document_type"]
          p_file_name: string
          p_file_size: number
          p_mime_type: string
          p_storage_path: string
          p_title: string
        }
        Returns: string
      }
      create_patient_document_as_practitioner: {
        Args: {
          p_appointment_id: string
          p_checksum: string
          p_description: string
          p_document_id: string
          p_document_type: Database["public"]["Enums"]["patient_document_type"]
          p_file_name: string
          p_file_size: number
          p_mime_type: string
          p_storage_path: string
          p_title: string
        }
        Returns: string
      }
      create_patient_record: {
        Args: {
          p_address_line1?: string
          p_address_line2?: string
          p_city?: string
          p_date_of_birth?: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_emergency_contact_relationship?: string
          p_full_name: string
          p_gender?: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_language?: string
          p_preferred_name?: string
          p_state?: string
        }
        Returns: string
      }
      create_prescription: {
        Args: { p_clinical_record_id: string }
        Returns: string
      }
      create_treatment_plan: {
        Args: { p_clinical_record_id: string }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_patient_id: { Args: never; Returns: string }
      current_practitioner_id: { Args: never; Returns: string }
      doctor_has_care_relationship: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
      doctor_owns_appointment: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      emit_notification_event: {
        Args: {
          p_dedupe_key: string
          p_event_type: Database["public"]["Enums"]["notification_event_type"]
          p_subject_id: string
          p_subject_type: Database["public"]["Enums"]["notification_subject_type"]
        }
        Returns: undefined
      }
      enqueue_notification_delivery: {
        Args: {
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_notification_id: string
          p_provider: string
        }
        Returns: string
      }
      find_possible_duplicate_patients: {
        Args: {
          p_date_of_birth?: string
          p_full_name: string
          p_phone?: string
        }
        Returns: {
          city: string
          date_of_birth: string
          full_name: string
          has_account: boolean
          id: string
          match_reason: string
          phone: string
          preferred_name: string
        }[]
      }
      get_practitioner_busy_intervals: {
        Args: { p_from: string; p_practitioner_id: string; p_to: string }
        Returns: {
          busy_end: string
          busy_start: string
        }[]
      }
      has_app_role: {
        Args: { target: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      issue_prescription: {
        Args: { p_expected_version: number; p_prescription_id: string }
        Returns: number
      }
      list_managed_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          email_confirmed: boolean
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      notification_appointment_context: {
        Args: { p_appointment_id: string }
        Returns: {
          appointment_type_name: string
          ends_at: string
          practitioner_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      notification_category_is_mandatory: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"]
        }
        Returns: boolean
      }
      notification_link_path: {
        Args: {
          p_audience: Database["public"]["Enums"]["notification_audience"]
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["notification_subject_type"]
        }
        Returns: string
      }
      notification_preference_enabled: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"]
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_user_id: string
        }
        Returns: boolean
      }
      notification_prescription_context: {
        Args: { p_prescription_id: string }
        Returns: {
          issued_at: string
          practitioner_name: string
          status: Database["public"]["Enums"]["prescription_status"]
        }[]
      }
      notification_recipient_for_resource: {
        Args: {
          p_audience: Database["public"]["Enums"]["notification_audience"]
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["notification_subject_type"]
        }
        Returns: string
      }
      notification_reminder_offsets: { Args: never; Returns: number[] }
      notification_treatment_plan_context: {
        Args: { p_plan_id: string }
        Returns: {
          activated_at: string
          practitioner_name: string
          status: Database["public"]["Enums"]["treatment_plan_status"]
        }[]
      }
      patient_document_extension: {
        Args: { p_mime_type: string }
        Returns: string
      }
      patient_document_storage_path: {
        Args: {
          p_document_id: string
          p_mime_type: string
          p_patient_id: string
        }
        Returns: string
      }
      plan_appointment_reminders: {
        Args: { p_appointment_id: string }
        Returns: {
          dedupe_key: string
          offset_minutes: number
          scheduled_for: string
        }[]
      }
      prescription_belongs_to_current_practitioner: {
        Args: { p_prescription_id: string }
        Returns: boolean
      }
      prescription_is_visible_to_current_patient: {
        Args: { p_prescription_id: string }
        Returns: boolean
      }
      record_notification_delivery_result: {
        Args: {
          p_delivery_id: string
          p_error_code?: string
          p_provider_message_id?: string
          p_retry_at?: string
          p_status: Database["public"]["Enums"]["notification_delivery_status"]
        }
        Returns: undefined
      }
      record_security_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["security_audit_action"]
          p_outcome: Database["public"]["Enums"]["security_audit_outcome"]
          p_request_id?: string
          p_resource_id?: string
          p_resource_type: Database["public"]["Enums"]["security_audit_resource"]
          p_subject_patient_id?: string
        }
        Returns: undefined
      }
      release_due_reminders: {
        Args: { p_limit?: number }
        Returns: {
          notification_id: string
          released: boolean
        }[]
      }
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: undefined
      }
      reschedule_appointment_as_staff: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: undefined
      }
      save_clinical_draft: {
        Args: {
          p_assessment: string
          p_chief_complaint: string
          p_clinical_observations: string
          p_diagnosis_or_clinical_impression: string
          p_doctor_notes: string
          p_expected_version: number
          p_follow_up_notes: string
          p_history_of_presenting_concern: string
          p_record_id: string
          p_symptoms: string
        }
        Returns: number
      }
      save_prescription_draft: {
        Args: {
          p_expected_version: number
          p_general_instructions: string
          p_items: Json
          p_prescription_id: string
        }
        Returns: number
      }
      save_treatment_plan_draft: {
        Args: {
          p_expected_version: number
          p_follow_up_on: string
          p_items: Json
          p_start_date: string
          p_summary: string
          p_title: string
          p_treatment_plan_id: string
        }
        Returns: number
      }
      search_care_patients: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          date_of_birth: string
          full_name: string
          id: string
          last_appointment_at: string
          phone: string
          preferred_name: string
        }[]
      }
      search_patients: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          city: string
          date_of_birth: string
          full_name: string
          has_account: boolean
          id: string
          phone: string
          preferred_name: string
        }[]
      }
      search_prescribed_medicines: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          form: string
          medicine_name: string
        }[]
      }
      security_audit_recent: {
        Args: { p_limit?: number }
        Returns: {
          action: Database["public"]["Enums"]["security_audit_action"]
          actor_id: string
          actor_role: Database["public"]["Enums"]["app_role"]
          occurred_at: string
          outcome: Database["public"]["Enums"]["security_audit_outcome"]
          resource_id: string
          resource_type: Database["public"]["Enums"]["security_audit_resource"]
          subject_patient_id: string
        }[]
      }
      set_notification_preference: {
        Args: {
          p_category: Database["public"]["Enums"]["notification_category"]
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_enabled: boolean
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_ai_assistance_session: {
        Args: {
          p_appointment_id: string
          p_context_fingerprint: string
          p_model: string
          p_prompt_version: string
          p_provider: string
          p_task: Database["public"]["Enums"]["ai_assistance_task"]
        }
        Returns: {
          resolved_clinical_record_id: string
          resolved_patient_id: string
          session_id: string
        }[]
      }
      start_consultation: {
        Args: { p_appointment_id: string }
        Returns: string
      }
      treatment_plan_belongs_to_current_practitioner: {
        Args: { p_treatment_plan_id: string }
        Returns: boolean
      }
      treatment_plan_is_visible_to_current_patient: {
        Args: { p_treatment_plan_id: string }
        Returns: boolean
      }
      update_appointment_status_as_doctor: {
        Args: {
          p_appointment_id: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: undefined
      }
      update_appointment_status_as_staff: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      ai_assistance_status: "pending" | "succeeded" | "failed" | "rejected"
      ai_assistance_task:
        | "clinical_summary"
        | "missing_information"
        | "clinical_considerations"
        | "consultation_summary"
      app_role: "patient" | "receptionist" | "doctor" | "admin"
      appointment_event_type: "created" | "status_changed" | "rescheduled"
      appointment_status:
        | "requested"
        | "confirmed"
        | "checked_in"
        | "in_consultation"
        | "completed"
        | "cancelled"
        | "no_show"
      clinical_record_status: "draft" | "completed" | "amended"
      notification_audience: "patient" | "practitioner"
      notification_category:
        | "appointment_updates"
        | "appointment_reminders"
        | "clinical_updates"
      notification_channel: "in_app" | "email"
      notification_delivery_status: "pending" | "sent" | "failed" | "skipped"
      notification_event_type:
        | "appointment_confirmed"
        | "appointment_rescheduled"
        | "appointment_cancelled"
        | "appointment_reminder"
        | "prescription_issued"
        | "treatment_plan_activated"
      notification_outbox_status:
        | "pending"
        | "processing"
        | "processed"
        | "failed"
        | "skipped"
      notification_status: "scheduled" | "active" | "cancelled"
      notification_subject_type:
        | "appointment"
        | "prescription"
        | "treatment_plan"
      patient_document_status: "active" | "archived"
      patient_document_type:
        | "lab_report"
        | "diagnostic_report"
        | "medical_image"
        | "previous_prescription"
        | "referral"
        | "previous_record"
        | "other"
      patient_document_uploader: "patient" | "practitioner"
      prescription_status: "draft" | "issued" | "cancelled" | "amended"
      security_audit_action:
        | "clinical_record.read"
        | "prescription.read"
        | "treatment_plan.read"
        | "patient_record.read"
        | "document.access_granted"
        | "report.exported"
        | "authorization.denied"
        | "patient_register.read"
      security_audit_outcome: "allowed" | "denied"
      security_audit_resource:
        | "clinical_record"
        | "prescription"
        | "treatment_plan"
        | "patient"
        | "document"
        | "report"
        | "route"
      treatment_plan_category:
        | "diet"
        | "lifestyle"
        | "therapy"
        | "follow_up"
        | "other"
      treatment_plan_status: "draft" | "active" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_assistance_status: ["pending", "succeeded", "failed", "rejected"],
      ai_assistance_task: [
        "clinical_summary",
        "missing_information",
        "clinical_considerations",
        "consultation_summary",
      ],
      app_role: ["patient", "receptionist", "doctor", "admin"],
      appointment_event_type: ["created", "status_changed", "rescheduled"],
      appointment_status: [
        "requested",
        "confirmed",
        "checked_in",
        "in_consultation",
        "completed",
        "cancelled",
        "no_show",
      ],
      clinical_record_status: ["draft", "completed", "amended"],
      notification_audience: ["patient", "practitioner"],
      notification_category: [
        "appointment_updates",
        "appointment_reminders",
        "clinical_updates",
      ],
      notification_channel: ["in_app", "email"],
      notification_delivery_status: ["pending", "sent", "failed", "skipped"],
      notification_event_type: [
        "appointment_confirmed",
        "appointment_rescheduled",
        "appointment_cancelled",
        "appointment_reminder",
        "prescription_issued",
        "treatment_plan_activated",
      ],
      notification_outbox_status: [
        "pending",
        "processing",
        "processed",
        "failed",
        "skipped",
      ],
      notification_status: ["scheduled", "active", "cancelled"],
      notification_subject_type: [
        "appointment",
        "prescription",
        "treatment_plan",
      ],
      patient_document_status: ["active", "archived"],
      patient_document_type: [
        "lab_report",
        "diagnostic_report",
        "medical_image",
        "previous_prescription",
        "referral",
        "previous_record",
        "other",
      ],
      patient_document_uploader: ["patient", "practitioner"],
      prescription_status: ["draft", "issued", "cancelled", "amended"],
      security_audit_action: [
        "clinical_record.read",
        "prescription.read",
        "treatment_plan.read",
        "patient_record.read",
        "document.access_granted",
        "report.exported",
        "authorization.denied",
        "patient_register.read",
      ],
      security_audit_outcome: ["allowed", "denied"],
      security_audit_resource: [
        "clinical_record",
        "prescription",
        "treatment_plan",
        "patient",
        "document",
        "report",
        "route",
      ],
      treatment_plan_category: [
        "diet",
        "lifestyle",
        "therapy",
        "follow_up",
        "other",
      ],
      treatment_plan_status: ["draft", "active", "completed", "cancelled"],
    },
  },
} as const
