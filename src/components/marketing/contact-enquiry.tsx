import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPhone, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

/**
 * The enquiry section of the contact page.
 *
 * ## Why there is no form on this page today
 *
 * Punarvasu has no message-delivery channel: no email provider is configured,
 * no enquiries table exists, and no retention or access policy has been
 * agreed for storing what people write about their health
 * (`docs/implementation-plan/phase_05.md` sections 40 and 43,
 * `docs/SECURITY.md` section 33).
 *
 * That left three options. A form that silently discards messages is a lie. A
 * form that always fails invites someone to write out their question and then
 * throws it away. Only offering the channel that actually works is honest, so
 * this section renders the direct-contact panel and says plainly why.
 *
 * The form itself is built, validated and tested - `ContactForm` and
 * `features/contact/schema.ts`. It is not rendered anywhere, and that is
 * deliberate rather than unfinished: `phase_05.md` section 40 asks for the UI
 * and validation foundation with the backend documented for later, and
 * forbids fake submission success. `CONTACT_FORM_DELIVERY` in
 * `features/contact/content.ts` is the switch, and the enabling change
 * replaces this `Alert` with `<ContactForm onSubmit={...} />`.
 *
 * A server component. Renders nothing when there is no phone number to offer
 * either, because an empty heading helps nobody.
 */
export interface ContactEnquirySectionProps {
  readonly contact: ClinicContact;
}

export function ContactEnquirySection({ contact }: ContactEnquirySectionProps) {
  const phoneDisplay = formatPhone(contact.phone);

  if (!contact.phone) {
    return null;
  }

  return (
    <Section
      id={CONTACT_SECTIONS.enquiry}
      aria-labelledby="contact-enquiry-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="contact-enquiry-title"
              eyebrow={CONTACT_PAGE.enquiryUnavailable.eyebrow}
              title={CONTACT_PAGE.enquiryUnavailable.title}
            />
          </div>

          <div className="lg:col-span-7">
            <Alert
              tone="info"
              title="How to reach someone today"
              className="measure"
            >
              <span className="flex flex-col items-start gap-4">
                {CONTACT_PAGE.enquiryUnavailable.body}
                <Button asChild size="lg">
                  <a href={`tel:${contact.phone}`}>
                    {CONTACT_PAGE.labels.phoneAction}
                    {phoneDisplay ? (
                      <span className="sr-only">: {phoneDisplay}</span>
                    ) : null}
                  </a>
                </Button>
              </span>
            </Alert>
          </div>
        </div>
      </Container>
    </Section>
  );
}
