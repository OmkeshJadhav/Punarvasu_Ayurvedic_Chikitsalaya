/**
 * Contact page content.
 *
 * Copy only. Every clinic *fact* - address, phone, hours, map - comes from
 * `config/clinic.ts`, never from here, so there is exactly one place a wrong
 * address could come from (`docs/implementation-plan/phase_05.md` sections 30
 * and 63).
 *
 * ## The delivery gate
 *
 * `CONTACT_FORM_DELIVERY` decides whether the enquiry form is rendered at
 * all. It is `null` today because Punarvasu has no message-delivery channel:
 * no email provider is configured, no enquiries table exists, and no
 * retention or access policy has been agreed for storing what people write
 * (`phase_05.md` sections 40 and 43).
 *
 * The options were: show a form that silently discards messages, show a form
 * that always fails, or show the channel that actually works. Only the third
 * is honest, so the page renders the direct-contact panel and the form
 * foundation - schema, component, states - waits behind this constant.
 * `phase_05.md` section 40's "do not create fake submission success" is the
 * rule being obeyed.
 */

/**
 * How an enquiry would be delivered.
 *
 * `null` means no channel exists and the form is not rendered. The phase that
 * adds one sets this and supplies `ContactForm` with a submit function; the
 * component and its four states are already built and tested against that
 * contract.
 */
export const CONTACT_FORM_DELIVERY: null = null;

export function isContactFormEnabled(): boolean {
  return CONTACT_FORM_DELIVERY !== null;
}

/** Anchor ids for the contact page's sections. */
export const CONTACT_SECTIONS = {
  channels: "contact-details",
  location: "location",
  hours: "hours",
  enquiry: "enquiry",
  faq: "questions",
} as const;

export const CONTACT_PAGE = {
  hero: {
    eyebrow: "Contact",
    title: "Talk to the clinic",
    // Deliberately promises no response time: the clinic has not stated one,
    // and "we reply within 24 hours" is exactly the sort of commitment a
    // website makes on a clinic's behalf without asking (`phase_05.md` s.28).
    description:
      "Questions about consultations, directions, or anything else about visiting Punarvasu. The fastest way to reach us is by phone.",
  },

  channels: {
    eyebrow: "How to reach us",
    title: "Contact details",
    description:
      "Everything the clinic has confirmed for publication. Where a detail is missing below, it is because it has not been confirmed - not because it is hidden.",
  },

  /** Copy for each channel, paired with its verified value at render time. */
  labels: {
    phone: "Phone",
    phoneHelp: "Calling is the quickest way to reach the clinic.",
    phoneAction: "Call the clinic",
    email: "Email",
    address: "Visit us",
    hours: "Opening hours",
    directions: "Get directions",
    openInMaps: "Open in Google Maps",
  },

  /**
   * The honest absence states.
   *
   * `phase_05.md` sections 29 and 35: display only verified information, and
   * where it is unknown, omit it or mark it clearly. Marking it is better
   * than omitting it here, because "what time do they open?" is a question
   * the visitor came with - silence leaves them looking.
   */
  unavailable: {
    email:
      "The clinic has not published an email address. Please call instead, or use the enquiry details above.",
    hours:
      "The clinic has not confirmed its opening hours for publication yet, so none are shown. Please call before visiting.",
  },

  location: {
    eyebrow: "Finding us",
    title: "Where the clinic is",
    description:
      "On the first floor, near Sai Baba Mandir Road in Godoli. The address and directions below work with or without the map.",
    mapTitle: "Map showing the location of Punarvasu Ayurvedic Chikitsalaya",
    /**
     * Disclosure, kept even though the frame now loads with the page.
     *
     * An embedded map is a third party receiving a request from the
     * visitor's browser, and saying so is worth a caption
     * (`docs/SECURITY.md` section 23).
     */
    mapPrivacyNote:
      "The map is provided by Google Maps, which your browser contacts directly and which may set cookies.",
    mapUnavailable:
      "An interactive map is not configured for this clinic. The address above is complete, and the directions link opens it in your maps app.",
  },

  enquiry: {
    eyebrow: "Send a message",
    title: "Ask us a question",
    description:
      "For anything that is not urgent. We will reply to the email address or phone number you give us.",
    submitLabel: "Send message",
    submittingLabel: "Sending",
    /**
     * The sensitive-information warning.
     *
     * `phase_05.md` section 37 and `docs/SECURITY.md` section 14. An enquiry
     * form is not a protected channel, so the page must actively discourage
     * putting health information into it rather than merely not asking for
     * it.
     */
    privacyWarning:
      "Please do not include medical history, symptoms, reports or any other health information in this form - it is not a secure channel. A practitioner will go through your health history with you during a consultation.",
    successTitle: "Thank you. Your message has been received.",
    successBody:
      "Someone from the clinic will get back to you. If your question is urgent, please call instead.",
    errorTitle: "We couldn't send your message right now.",
    errorBody: "Please try again, or contact the clinic directly by phone.",
    fields: {
      name: { label: "Your name", autoComplete: "name" },
      email: {
        label: "Email address",
        autoComplete: "email",
        description: "So we can reply to you.",
      },
      phone: {
        label: "Phone number",
        autoComplete: "tel",
        description: "Optional. Useful if you would rather we called back.",
      },
      message: {
        label: "Your message",
        description:
          "What you would like to ask. Please keep health details out of it.",
      },
      /** Never seen by a person; the label exists for the accessibility tree. */
      honeypot: { label: "Company (leave this field empty)" },
    },
  },

  /**
   * The state the page is in today: the form foundation exists but there is
   * no delivery channel, so no form is shown.
   *
   * Rendered in place of the form, not as a note beside it. A visitor should
   * never type a message into a box that cannot send it.
   */
  enquiryUnavailable: {
    // Its own eyebrow: "Send a message" above "not connected yet" reads as a
    // contradiction, and the section is about how to reach someone, not about
    // a form.
    eyebrow: "Getting in touch",
    title: "Online messages are not connected yet",
    body: "Punarvasu does not yet have an online enquiry channel set up, and this site will not show you a form that quietly goes nowhere. Please call the clinic - that reaches someone today.",
  },

  faq: {
    eyebrow: "Before you visit",
    title: "Practical questions",
    description:
      "If your question is not answered here, ask it when you call — we would rather answer it properly than approximately.",
  },

  /**
   * PLACEHOLDER - requires clinic confirmation.
   *
   * Each answer is written so that it stays true whatever Punarvasu's
   * specific policies turn out to be. Questions whose only useful answer is a
   * fact the clinic has not supplied - opening hours, whether walk-ins are
   * taken, parking - are answered by saying so and pointing at the phone,
   * rather than with a plausible guess (`phase_05.md` section 46).
   */
  faqItems: [
    {
      id: "where",
      question: "Where exactly is the clinic?",
      answer:
        "Punarvasu is on the first floor of Samruddhi 7 Apartment, near Sai Baba Mandir Road, Godoli, Satara, Maharashtra 415001. The full address, a map and a directions link are on this page.",
    },
    {
      id: "hours",
      question: "What are the clinic's opening hours?",
      answer:
        "The clinic has not confirmed its opening hours for publication, so this site does not state them rather than risk sending you at the wrong time. Please call before you set out.",
    },
    {
      id: "appointment",
      question: "Do I need an appointment?",
      answer:
        "Online booking is not open yet, so a consultation is arranged by contacting the clinic. Call and ask; whether a visit without an appointment is possible is the clinic's decision to tell you, not this website's to predict.",
    },
    {
      id: "first-visit",
      question: "How should I prepare for a first visit?",
      answer:
        "Bring any recent medical reports, investigations and prescriptions you have, including medicines prescribed by other doctors. It also helps to arrive with a sense of your usual routine — meal times, sleep, work — because those form part of the assessment.",
    },
    {
      id: "what-happens",
      question: "What happens during a consultation?",
      answer:
        "Your practitioner takes a full Ayurvedic history and asks about far more than the complaint that brought you in. The assessment comes first; anything suggested afterwards follows from it and is explained to you before it starts.",
    },
    {
      id: "urgent",
      question: "What if my problem is urgent?",
      answer:
        "Punarvasu is a clinic, not an emergency service. If you have severe, sudden or worsening symptoms, contact emergency medical services or your nearest hospital rather than waiting for a consultation here.",
    },
  ],

  cta: {
    title: "Ready when you are",
    description:
      "A first consultation is a conversation. Tell us what brought you here, and we will arrange a time.",
    secondaryLabel: "Read about the clinic",
  },
} as const;
