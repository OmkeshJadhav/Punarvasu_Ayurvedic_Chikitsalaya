"use client";

import { useId, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_LIMITS,
  EMPTY_CONTACT_FORM,
  contactEnquirySchema,
  validateContactForm,
  type ContactEnquiry,
  type ContactFieldErrors,
  type ContactFormValues,
} from "@/features/contact/schema";
import { CONTACT_PAGE } from "@/features/contact/content";

/**
 * The enquiry form.
 *
 * ## What this component is for
 *
 * It is the UI half of the contact foundation
 * (`docs/implementation-plan/phase_05.md` section 40). Punarvasu has no
 * message-delivery channel yet, so `/contact` does not render it - see
 * `CONTACT_FORM_DELIVERY` in `features/contact/content.ts` for why showing a
 * form that quietly goes nowhere was rejected. The component exists, complete
 * and tested, so that the phase which adds a channel supplies `onSubmit` and
 * changes nothing else.
 *
 * ## States
 *
 * `idle` -> `submitting` -> `success` | `error`, and every one of them is
 * handled (`phase_05.md` section 41). The submit button carries `loading`
 * through the whole submission, which sets `aria-busy` and disables the
 * control, so a double tap cannot produce two enquiries. Success replaces the
 * form rather than sitting above it, because a form still on screen after a
 * confirmation invites a second send.
 *
 * ## Validation
 *
 * `features/contact/schema.ts` is the single definition of a valid enquiry
 * and is written to run on both sides of the trust boundary. Here it runs on
 * submit for immediate feedback, and again per-field once a field has been
 * corrected, so a visitor is not scolded while they are still typing. It is
 * never the security control: the route that a later phase adds must parse
 * the body through the same schema server-side
 * (`docs/SECURITY.md` section 9).
 *
 * ## Errors
 *
 * The failure message is fixed copy naming the clinic's phone as the way
 * through. Whatever the underlying cause, the visitor sees the same safe
 * sentence and never a server message (`phase_05.md` section 69).
 *
 * ## Health information
 *
 * The warning above the fields is not decoration. A public form is not a
 * protected channel, so the page actively discourages putting health
 * information into it rather than merely not asking for it
 * (`phase_05.md` sections 37 and 71).
 */
export type ContactFormStatus = "idle" | "submitting" | "success" | "error";

export interface ContactFormProps {
  /**
   * Delivers a validated enquiry. Rejecting puts the form into its error
   * state; the reason is logged by the caller and never shown.
   */
  readonly onSubmit: (enquiry: ContactEnquiry) => Promise<void>;
  /** A way to reach the clinic, shown beside the failure message. */
  readonly fallbackAction?: React.ReactNode;
  readonly className?: string;
}

export function ContactForm({
  onSubmit,
  fallbackAction,
  className,
}: ContactFormProps) {
  const formId = useId();
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [status, setStatus] = useState<ContactFormStatus>("idle");

  const { enquiry } = CONTACT_PAGE;
  const submitting = status === "submitting";

  function setField(field: keyof ContactFormValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));

    // Clear a field's error as soon as it becomes valid again, but never
    // introduce one mid-keystroke: being corrected while still typing is the
    // most disliked behaviour a form has.
    if (errors[field]) {
      const next = validateContactForm({ ...values, [field]: value });
      if (!next[field]) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const parsed = contactEnquirySchema.safeParse(values);
    if (!parsed.success) {
      setErrors(validateContactForm(values));
      setStatus("idle");
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      await onSubmit(parsed.data);
      setStatus("success");
      setValues(EMPTY_CONTACT_FORM);
    } catch {
      // The reason is deliberately not read: the caller owns logging it, and
      // nothing about a failure is safe to put in front of a visitor.
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <Alert tone="success" title={enquiry.successTitle} className={className}>
        {enquiry.successBody}
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className={className}
    >
      <Alert tone="warning" title="Please keep health details out of this form">
        {enquiry.privacyWarning}
      </Alert>

      <div className="mt-6 flex flex-col gap-5">
        <Field
          name="name"
          label={enquiry.fields.name.label}
          error={errors.name}
          required
          disabled={submitting}
        >
          {(control) => (
            <Input
              {...control}
              autoComplete={enquiry.fields.name.autoComplete}
              maxLength={CONTACT_LIMITS.nameMax}
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          )}
        </Field>

        <Field
          name="email"
          label={enquiry.fields.email.label}
          description={enquiry.fields.email.description}
          error={errors.email}
          required
          disabled={submitting}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              inputMode="email"
              autoComplete={enquiry.fields.email.autoComplete}
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          )}
        </Field>

        <Field
          name="phone"
          label={enquiry.fields.phone.label}
          description={enquiry.fields.phone.description}
          error={errors.phone}
          disabled={submitting}
        >
          {(control) => (
            <Input
              {...control}
              type="tel"
              inputMode="tel"
              autoComplete={enquiry.fields.phone.autoComplete}
              value={values.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          )}
        </Field>

        <Field
          name="message"
          label={enquiry.fields.message.label}
          description={enquiry.fields.message.description}
          error={errors.message}
          required
          disabled={submitting}
        >
          {(control) => (
            <Textarea
              {...control}
              maxLength={CONTACT_LIMITS.messageMax}
              value={values.message}
              onChange={(event) => setField("message", event.target.value)}
            />
          )}
        </Field>

        {/*
          The honeypot. Hidden from sight and from assistive technology, and
          removed from the tab order, so no person ever encounters it; a bot
          that fills every input it finds fills this one and is rejected.
          `aria-hidden` plus `tabIndex={-1}` rather than `display: none`,
          because some bots skip fields that are not rendered at all.
        */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor={`${formId}-honeypot`}>
            {enquiry.fields.honeypot.label}
          </label>
          <input
            id={`${formId}-honeypot`}
            name={CONTACT_HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values[CONTACT_HONEYPOT_FIELD]}
            onChange={(event) =>
              setField(CONTACT_HONEYPOT_FIELD, event.target.value)
            }
          />
        </div>

        {status === "error" ? (
          <Alert tone="danger" title={enquiry.errorTitle}>
            <span className="flex flex-col items-start gap-3">
              {enquiry.errorBody}
              {fallbackAction}
            </span>
          </Alert>
        ) : null}

        {/*
          A form-level error for the honeypot, which has no visible field to
          attach a message to. A person can only reach this by filling a
          control they cannot see.
        */}
        {errors[CONTACT_HONEYPOT_FIELD] ? (
          <FieldError>{errors[CONTACT_HONEYPOT_FIELD]}</FieldError>
        ) : null}

        <div>
          <Button
            type="submit"
            size="lg"
            loading={submitting}
            loadingLabel={enquiry.submittingLabel}
            block
            className="sm:w-auto"
          >
            {enquiry.submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
