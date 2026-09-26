import { MessageCircle, Phone } from "lucide-react";

import { Container } from "@/components/layout/container";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { formatPhone, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

/**
 * Where an enquiry form would be, and why there is not one.
 *
 * ## Why there is no form on this page today
 *
 * Punarvasu has no message-delivery channel: no email provider is configured,
 * no enquiries table exists, and no retention or access policy has been
 * agreed for storing what people write about their health
 * (`docs/implementation-plan/phase_05.md` sections 40 and 43,
 * `docs/SECURITY.md` section 33).
 *
 * A form that silently discards messages is a lie, and a form that always
 * fails invites someone to write out their question and then throws it away.
 * Only offering the channel that works is honest, so this is a short notice
 * with the phone beside it.
 *
 * The form itself is built, validated and tested - `ContactForm` and
 * `features/contact/schema.ts` - and `CONTACT_FORM_DELIVERY` in
 * `features/contact/content.ts` is the switch. The enabling change replaces
 * this notice with `<ContactForm onSubmit={...} />` under the same anchor,
 * which the services page already links to.
 *
 * ## Presentation
 *
 * A notice panel inside an ivory band rather than a full band of its own: it
 * is a short aside between two sections, and giving it a section's full
 * weight would make an absence look like a feature.
 *
 * A server component. Renders nothing when there is no phone number to offer
 * either, because an empty notice helps nobody.
 */
export interface ContactEnquiryNoticeProps {
  readonly contact: ClinicContact;
}

export function ContactEnquiryNotice({ contact }: ContactEnquiryNoticeProps) {
  const { enquiryUnavailable, labels } = CONTACT_PAGE;
  const phoneDisplay = formatPhone(contact.phone);

  if (!contact.phone) {
    return null;
  }

  return (
    <section
      id={CONTACT_SECTIONS.enquiry}
      aria-labelledby="contact-enquiry-title"
      className="anchor-offset bg-background border-border border-t pt-14 md:pt-20"
    >
      <Container width="wide">
        <Reveal className="border-border bg-muted relative isolate grid gap-8 overflow-hidden rounded-xl border p-6 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12">
          <LeafSprig
            sizes="11rem"
            className="absolute -right-6 -bottom-10 -z-10 hidden w-44 -rotate-[24deg] opacity-40 saturate-50 sm:block"
          />

          <div className="flex items-start gap-5 sm:gap-6 lg:col-span-6">
            <span
              aria-hidden="true"
              className="bg-secondary text-terracotta flex size-14 shrink-0 items-center justify-center rounded-full sm:size-16"
            >
              <MessageCircle className="size-6" strokeWidth={1.25} />
            </span>
            <div>
              <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                {enquiryUnavailable.eyebrow}
              </p>
              <h2
                id="contact-enquiry-title"
                className="text-h3 text-heading mt-3 font-normal"
              >
                {enquiryUnavailable.title}
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-start gap-5 lg:col-span-6">
            <p className="text-body text-prose max-w-md">
              {enquiryUnavailable.body}
            </p>
            <Button asChild block className="sm:w-auto">
              <a href={`tel:${contact.phone}`}>
                <Phone aria-hidden="true" strokeWidth={1.5} />
                {labels.phoneAction}
                {phoneDisplay ? (
                  <span className="sr-only">: {phoneDisplay}</span>
                ) : null}
              </a>
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
