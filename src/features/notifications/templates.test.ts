import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EVENT_CATEGORY,
  NEUTRAL_EMAIL_SUBJECT,
  NOTIFICATION_TEMPLATE_VERSION,
  renderEmail,
  renderNotification,
  renderPractitionerNotification,
  type NotificationTemplateData,
  type PractitionerNotificationTemplateData,
} from "./templates";
import type { NotificationEventType } from "./types";

/**
 * What a notification is allowed to say.
 *
 * This is the privacy test suite `phase_15.md` section 128 asks for, applied
 * where it can actually hold: at the one place that writes the words.
 *
 * The strongest guarantee is not asserted here at all — it is that a template
 * has no way to *reach* a diagnosis, a medicine or a note, because the context
 * functions that feed it do not return one. What is asserted here is the
 * second line of defence: that the words a template does write contain none of
 * it either, and that an email subject says even less than an email body.
 */

const PRACTITIONER = "Dr Anaya Kulkarni";
const APPOINTMENT_TYPE = "Initial consultation";
const STARTS_AT = new Date("2026-09-19T05:00:00.000Z"); // 10:30 am IST

/**
 * Words that would betray something about somebody's health if they appeared
 * in a message that arrives on a lock screen.
 *
 * Deliberately broad. A template that legitimately needed one of these would
 * be a template worth arguing about.
 *
 * Matched on **word boundaries**, not as substrings. A substring scan reads
 * "lab" out of "available" and "mg" out of a dozen ordinary words, which is a
 * test that fails for reasons nobody can act on — and a test somebody would
 * then weaken. `containsClinicalWord` is the thing that has to be right.
 */
const CLINICAL_WORDS = [
  "diagnosis",
  "diagnosed",
  "symptom",
  "assessment",
  "impression",
  "medicine",
  "medication",
  "dose",
  "dosage",
  "tablet",
  "churna",
  "kashaya",
  "mg",
  "twice daily",
  "complaint",
  "history",
  "note",
  "lab",
  "report",
  "result",
  "glucose",
  "blood",
  "therapy",
  "panchakarma",
  "diet",
  "allergy",
] as const;

/**
 * The first clinical word `text` contains as a whole word, or `null`.
 *
 * The boundary is built with `String.raw`, not a plain template literal.
 * `` `\b` `` in a template literal is a **backspace character**, not a word
 * boundary — so the naive version compiles, runs, matches nothing, and makes
 * every privacy assertion below pass vacuously. That is the same class of
 * defect Phase 06 found in `lib/auth/redirect.ts` and Phase 14 found in two
 * security assertions: a check that cannot fail for the reason you care about
 * is worse than no check.
 *
 * `scans for a word it is meant to find` below is the guard against it.
 */
function containsClinicalWord(text: string): string | null {
  for (const word of CLINICAL_WORDS) {
    const pattern = new RegExp(
      String.raw`\b${word.replace(/ /g, String.raw`\s+`)}\b`,
      "i",
    );
    if (pattern.test(text)) return word;
  }
  return null;
}

const APPOINTMENT_EVENTS: readonly NotificationEventType[] = [
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_reminder",
];

function renderEvery(): {
  event: NotificationEventType;
  rendered: ReturnType<typeof renderNotification>;
}[] {
  const inputs: NotificationTemplateData[] = [
    ...APPOINTMENT_EVENTS.map(
      (event) =>
        ({
          event,
          data: {
            practitionerName: PRACTITIONER,
            appointmentTypeName: APPOINTMENT_TYPE,
            startsAt: STARTS_AT,
          },
        }) as NotificationTemplateData,
    ),
    {
      event: "prescription_issued",
      data: { practitionerName: PRACTITIONER },
    },
    {
      event: "treatment_plan_activated",
      data: { practitionerName: PRACTITIONER },
    },
  ];

  return inputs.map((input) => ({
    event: input.event,
    rendered: renderNotification(input),
  }));
}

describe("every event has a template", () => {
  it("covers every value of the event enum", () => {
    const migration = readFileSync(
      new URL(
        "../../../supabase/migrations/20260926120000_notifications.sql",
        import.meta.url,
      ),
      "utf8",
    );

    const declared =
      /create type public\.notification_event_type as enum \(([^)]*)\)/.exec(
        migration,
      )?.[1] ?? "";

    const values = [...declared.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    // A missing template would mean an event the processor could claim and
    // then fail to render for ever.
    expect([...values].sort()).toEqual(Object.keys(EVENT_CATEGORY).sort());
  });

  it("assigns every event to a preference category", () => {
    for (const [event, category] of Object.entries(EVENT_CATEGORY)) {
      expect(category, `${event} has no category`).toBeTruthy();
    }
  });

  it("puts reminders in their own category, so they can be switched off", () => {
    // Section 22: reminders are the optional one. If a reminder shared a
    // category with a confirmation, switching reminders off would switch off
    // a cancellation notice too.
    expect(EVENT_CATEGORY.appointment_reminder).toBe("appointment_reminders");
    expect(EVENT_CATEGORY.appointment_confirmed).toBe("appointment_updates");
    expect(EVENT_CATEGORY.appointment_cancelled).toBe("appointment_updates");
  });
});

/* ------------------------------------------------------------------------ */
/* The practitioner's vocabulary                                             */
/* ------------------------------------------------------------------------ */

const PRACTITIONER_EVENTS: readonly PractitionerNotificationTemplateData["event"][] =
  ["appointment_confirmed", "appointment_rescheduled", "appointment_cancelled"];

function renderEveryPractitioner(): {
  event: PractitionerNotificationTemplateData["event"];
  rendered: ReturnType<typeof renderPractitionerNotification>;
}[] {
  return PRACTITIONER_EVENTS.map((event) => ({
    event,
    rendered: renderPractitionerNotification({
      event,
      data: { appointmentTypeName: APPOINTMENT_TYPE, startsAt: STARTS_AT },
    } as PractitionerNotificationTemplateData),
  }));
}

/**
 * A plausible patient, and every way one might leak into a message.
 *
 * None of these is an input to a practitioner template — the interface has no
 * field for any of them — so the assertion below is a second line of defence
 * behind a compiler error, exactly as the clinical-word scan is behind the
 * context functions.
 */
const PATIENT_NAME = "Meera Sharma";

describe("the practitioner's templates", () => {
  it("cover the three events a practitioner is told about, and no more", () => {
    // Not six. A reminder would be sixteen messages about a day they are
    // already looking at (sections 56, 61), and a prescription notification
    // would tell them about the prescription they had just written.
    expect(renderEveryPractitioner()).toHaveLength(3);

    for (const { rendered } of renderEveryPractitioner()) {
      expect(rendered.title.length).toBeGreaterThan(0);
      expect(rendered.body.length).toBeGreaterThan(0);
      expect(rendered.templateVersion).toBe(NOTIFICATION_TEMPLATE_VERSION);
    }
  });

  it.each(renderEveryPractitioner())(
    "$event names no patient",
    ({ rendered }) => {
      // Sections 36, 37 and 57. A practitioner may know who is on their own
      // list; a lock screen may not be told.
      const text = `${rendered.title} ${rendered.body}`;

      expect(text).not.toContain(PATIENT_NAME);
      expect(text.toLowerCase()).not.toContain("patient");
    },
  );

  it.each(renderEveryPractitioner())(
    "$event says nothing clinical",
    ({ rendered }) => {
      const found = containsClinicalWord(`${rendered.title} ${rendered.body}`);
      expect(found, `contains "${found}"`).toBeNull();
    },
  );

  it.each(renderEveryPractitioner())(
    "$event carries the appointment type and the authoritative time",
    ({ rendered }) => {
      // Section 25: use real data, invent nothing.
      expect(rendered.body).toContain(APPOINTMENT_TYPE);
      expect(rendered.body).toMatch(/2026/);
    },
  );

  it("puts every practitioner message in the appointment-updates category", () => {
    // The same preference unit as a patient's, because it is the same fact
    // about the same appointment — and mandatory in-app for the same reason.
    for (const { rendered } of renderEveryPractitioner()) {
      expect(rendered.category).toBe("appointment_updates");
    }
  });

  it("says something different from what the patient is told", () => {
    // Two audiences, two vocabularies. If these ever converged, one of them
    // would be addressing the wrong person.
    for (const event of PRACTITIONER_EVENTS) {
      const theirs = renderPractitionerNotification({
        event,
        data: { appointmentTypeName: APPOINTMENT_TYPE, startsAt: STARTS_AT },
      } as PractitionerNotificationTemplateData);

      const patients = renderNotification({
        event,
        data: {
          practitionerName: PRACTITIONER,
          appointmentTypeName: APPOINTMENT_TYPE,
          startsAt: STARTS_AT,
        },
      } as NotificationTemplateData);

      expect(theirs.body).not.toBe(patients.body);
      // And never the practitioner's own name back at them.
      expect(theirs.body).not.toContain(PRACTITIONER);
    }
  });

  it("carries no cancellation reason", () => {
    // Section 27, and the same rule the patient's cancellation follows: a
    // cancellation note is written by staff for staff.
    const cancelled = renderPractitionerNotification({
      event: "appointment_cancelled",
      data: { appointmentTypeName: APPOINTMENT_TYPE, startsAt: STARTS_AT },
    });

    expect(cancelled.body.toLowerCase()).not.toContain("reason");
    expect(cancelled.body.toLowerCase()).not.toContain("because");
  });
});

/* ------------------------------------------------------------------------ */
/* Grammar against interpolated data                                         */
/* ------------------------------------------------------------------------ */

describe("no article ever precedes an interpolated value", () => {
  /**
   * The defect this guards, found by the first live worker run.
   *
   * The practitioner confirmation read "A Initial consultation is confirmed
   * for…". The consultation type is data — it is whatever the clinic named a
   * row in `appointment_types` — so an article written beside it in the
   * template cannot agree with it. Every unit test passed, because every
   * fixture happened to use a consonant-initial name.
   *
   * The fix was to restructure the sentences so no article is needed, rather
   * than to compute "a" against "an": section 100 asks that localization stay
   * possible later, and a hard-coded English article rule is the opposite of
   * that. This asserts the restructuring holds for **both** shapes of name.
   */
  const VOWEL_INITIAL = "Initial consultation";
  const CONSONANT_INITIAL = "Panchakarma therapy";

  /** "a" or "A" immediately before a word starting with a vowel. */
  const MISAGREED = /\ba\s+(?=[aeiou])/i;

  function everyMessage(appointmentTypeName: string): string[] {
    const appointment = {
      practitionerName: PRACTITIONER,
      appointmentTypeName,
      startsAt: STARTS_AT,
    };

    const patientMessages = APPOINTMENT_EVENTS.map((event) =>
      renderNotification({
        event,
        data: appointment,
      } as NotificationTemplateData),
    ).concat(
      renderNotification({
        event: "prescription_issued",
        data: { practitionerName: PRACTITIONER },
      }),
      renderNotification({
        event: "treatment_plan_activated",
        data: { practitionerName: PRACTITIONER },
      }),
    );

    const practitionerMessages = PRACTITIONER_EVENTS.map((event) =>
      renderPractitionerNotification({
        event,
        data: { appointmentTypeName, startsAt: STARTS_AT },
      } as PractitionerNotificationTemplateData),
    );

    return [...patientMessages, ...practitionerMessages].map(
      (m) => `${m.title} ${m.body}`,
    );
  }

  it("the detector finds the defect it is meant to find", () => {
    // Without this the assertions below could pass on a regex that matches
    // nothing — the failure mode section 14 of the progress record describes.
    expect(MISAGREED.test("A Initial consultation is confirmed")).toBe(true);
    expect(MISAGREED.test("a appointment has moved")).toBe(true);
    expect(MISAGREED.test("A Panchakarma therapy is confirmed")).toBe(false);
    expect(MISAGREED.test("has issued a prescription")).toBe(false);
  });

  it.each([VOWEL_INITIAL, CONSONANT_INITIAL])(
    "reads correctly when the consultation type is %s",
    (typeName) => {
      for (const message of everyMessage(typeName)) {
        expect(message, `misagreeing article in: ${message}`).not.toMatch(
          MISAGREED,
        );
      }
    },
  );

  it("still names the consultation type in every appointment message", () => {
    // The fix must not have removed the information along with the article.
    for (const typeName of [VOWEL_INITIAL, CONSONANT_INITIAL]) {
      const practitionerBodies = PRACTITIONER_EVENTS.map(
        (event) =>
          renderPractitionerNotification({
            event,
            data: { appointmentTypeName: typeName, startsAt: STARTS_AT },
          } as PractitionerNotificationTemplateData).body,
      );

      for (const body of practitionerBodies) {
        expect(body).toContain(typeName);
      }
    }
  });
});

describe("the clinical-word scanner", () => {
  it("scans for a word it is meant to find", () => {
    // Without this, a broken boundary makes every assertion below pass on an
    // empty result. It is the same guard `source-hygiene.test.ts` uses when
    // it asserts it scanned more than a hundred files.
    expect(containsClinicalWord("Your diagnosis is ready to collect.")).toBe(
      "diagnosis",
    );
    expect(containsClinicalWord("Take 500 mg twice daily.")).not.toBeNull();
  });

  it("matches whole words, not substrings", () => {
    // "available" contains "lab"; "among" contains "mg". A substring scan
    // fails for reasons nobody can act on, and is then weakened.
    expect(containsClinicalWord("Your prescription is available.")).toBeNull();
    expect(containsClinicalWord("Among other things.")).toBeNull();
  });

  it("matches across whitespace in a multi-word entry", () => {
    expect(containsClinicalWord("take it twice  daily")).toBe("twice daily");
  });
});

describe("clinical privacy", () => {
  it.each(renderEvery())("$event says nothing clinical", ({ rendered }) => {
    const text = `${rendered.title} ${rendered.body}`;
    expect(containsClinicalWord(text)).toBeNull();
  });

  it("tells a patient a prescription exists without saying what is in it", () => {
    // Section 33 and example 3. The good example, near enough word for word:
    // that something is waiting, and a place to go and read it.
    const rendered = renderNotification({
      event: "prescription_issued",
      data: { practitionerName: PRACTITIONER },
    });

    expect(rendered.body).toContain("prescription");
    expect(rendered.body.toLowerCase()).toContain("sign in");
    expect(rendered.body).not.toMatch(/\d+\s?(mg|ml|g)\b/i);
  });

  it("carries no cancellation reason", () => {
    // Section 27: a cancellation note is written by staff for staff. The
    // template has no input for one, which is the real guarantee; this
    // asserts the words do not imply one either.
    const rendered = renderNotification({
      event: "appointment_cancelled",
      data: {
        practitionerName: PRACTITIONER,
        appointmentTypeName: APPOINTMENT_TYPE,
        startsAt: STARTS_AT,
      },
    });

    expect(rendered.body.toLowerCase()).not.toContain("because");
    expect(rendered.body.toLowerCase()).not.toContain("reason");
  });

  it("never invents a practitioner, a time or a type", () => {
    // Section 25. Every value in the message came from the authoritative
    // context; none of these templates has a default or a placeholder.
    const rendered = renderNotification({
      event: "appointment_confirmed",
      data: {
        practitionerName: PRACTITIONER,
        appointmentTypeName: APPOINTMENT_TYPE,
        startsAt: STARTS_AT,
      },
    });

    expect(rendered.body).toContain(PRACTITIONER);
    expect(rendered.body).toContain(APPOINTMENT_TYPE);
    expect(rendered.body).not.toMatch(/\bTBC\b|\bTBD\b|your doctor\b/i);
  });
});

describe("dates", () => {
  it("are formatted in the clinic's timezone, not UTC", () => {
    // Section 32: never a raw UTC timestamp. Section 31: the Phase 09
    // formatters, not ad-hoc conversion per template.
    const rendered = renderNotification({
      event: "appointment_confirmed",
      data: {
        practitionerName: PRACTITIONER,
        appointmentTypeName: APPOINTMENT_TYPE,
        startsAt: STARTS_AT,
      },
    });

    // 05:00 UTC is 10:30 am in Asia/Kolkata.
    expect(rendered.body).toContain("10:30 am");
    expect(rendered.body).toContain("19 September 2026");
    expect(rendered.body).not.toContain("2026-09-19T");
    expect(rendered.body).not.toContain("GMT");
    expect(rendered.body).not.toContain("Z");
  });
});

describe("length", () => {
  it.each(renderEvery())(
    "$event fits the columns it is stored in",
    ({ rendered }) => {
      // `notifications_title_length` and `notifications_body_length`. A
      // template that overran would fail at insert time, in a worker, after
      // the domain operation had already succeeded.
      expect(rendered.title.trim().length).toBeGreaterThan(0);
      expect(rendered.title.length).toBeLessThanOrEqual(120);
      expect(rendered.body.trim().length).toBeGreaterThan(0);
      expect(rendered.body.length).toBeLessThanOrEqual(400);
    },
  );

  it("stays short enough to read on a lock screen", () => {
    for (const { rendered } of renderEvery()) {
      expect(rendered.body.length).toBeLessThanOrEqual(220);
    }
  });
});

describe("versioning", () => {
  it("stamps every rendered notification", () => {
    // Section 99: a template corrected later must not rewrite what somebody
    // was told earlier, and the version is how the two are told apart.
    for (const { rendered } of renderEvery()) {
      expect(rendered.templateVersion).toBe(NOTIFICATION_TEMPLATE_VERSION);
      expect(rendered.templateVersion).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("email", () => {
  it("puts the operational fact in an appointment subject", () => {
    const email = renderEmail({
      title: "Appointment confirmed",
      body: "Body.",
      category: "appointment_updates",
    });

    expect(email.subject).toContain("Appointment confirmed");
  });

  it("uses a neutral subject for anything clinical", () => {
    // Sections 37 and 82, and example 4. A subject and its preview are read
    // on a lock screen; the *existence* of a prescription is itself
    // information about somebody's health.
    for (const title of ["Prescription available", "Treatment plan updated"]) {
      const email = renderEmail({
        title,
        body: "Body.",
        category: "clinical_updates",
      });

      expect(email.subject).toBe(NEUTRAL_EMAIL_SUBJECT);
      expect(email.subject.toLowerCase()).not.toContain("prescription");
      expect(email.subject.toLowerCase()).not.toContain("treatment");
    }
  });

  it("says nothing clinical in any subject", () => {
    for (const { rendered } of renderEvery()) {
      expect(containsClinicalWord(renderEmail(rendered).subject)).toBeNull();
    }
  });

  it("carries the same wording as the in-app message", () => {
    // One message, one wording. A patient who reads both should not have to
    // reconcile them.
    for (const { rendered } of renderEvery()) {
      const email = renderEmail(rendered);
      expect(email.body).toBe(rendered.body);
      expect(email.heading).toBe(rendered.title);
    }
  });

  it("carries no attachment and no document content", () => {
    // Section 83: a sensitive document is never attached to a transactional
    // email. There is no attachment field in the rendered shape at all.
    const email = renderEmail({
      title: "Prescription available",
      body: "Body.",
      category: "clinical_updates",
    });

    expect(Object.keys(email).sort()).toEqual([
      "actionLabel",
      "body",
      "heading",
      "subject",
    ]);
  });
});
