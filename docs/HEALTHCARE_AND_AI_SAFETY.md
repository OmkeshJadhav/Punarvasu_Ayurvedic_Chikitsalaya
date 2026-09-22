# Punarvasu — Healthcare Content & AI Safety

> Status: **Binding policy from Phase 00 onward.**
>
> This document covers two related obligations: what the platform is allowed to
> *say* about health (§1–§3), and what AI is allowed to *do* in a clinical
> context (§5–§9).
>
> Both are non-negotiable. Where this document conflicts with a design
> preference, a deadline or a phase specification, this document wins.
>
> Note on scope: the "AI coding agent" rules in `AGENTS.md`, `SECURITY.md` §39
> and `QA_STRATEGY.md` §49 govern how AI writes *code* for this repository.
> This document governs AI as a *product feature* operating on patient data.
> They are different concerns and both apply.

---

## 1. Why This Document Exists

Punarvasu is healthcare software. Two failure modes here cause real harm
rather than mere inconvenience:

* A patient reads something on the site, believes it, and delays care they
  needed.
* A practitioner relies on generated or fabricated information and makes a
  worse clinical decision than they would have made unaided.

Ordinary software quality practices do not address either one. These rules do.

---

## 2. Never Fabricate Clinical or Clinic Information

The platform must never invent, approximate or plausibly fill in:

* Doctor names, credentials, degrees or specializations
* Registration, licence or council numbers
* Years of experience
* Certifications, accreditations or affiliations
* Awards and recognitions
* Patient testimonials or reviews
* Success rates, cure rates or recovery statistics
* Patient counts or clinical outcomes
* Research citations or study results
* Clinic addresses, timings, phone numbers or pricing

This applies to production content, seed data, fixtures, design mockups,
demonstrations and screenshots alike. A realistic-looking fake credential does
not become harmless because it is "only sample data" — it gets copied forward,
screenshotted, and eventually shipped.

**When real information is unavailable, use an obviously marked placeholder:**

```text
GOOD:  [Practitioner name — to be supplied by clinic]
       [BAMS qualification details pending verification]
       Lorem-style neutral filler with a visible TODO marker

BAD:   Dr. Anjali Sharma, BAMS, MD (Ayurveda), 15 years experience
       "Punarvasu cured my chronic condition in 3 weeks" — Rajesh K.
       98% patient satisfaction
```

The bad examples are dangerous precisely because they look finished.

---

## 3. Health Content Rules

### 3.1 Prohibited claims

Never state or imply:

* A guaranteed cure or guaranteed result
* "100% safe", "no side effects", "works for everyone"
* That a treatment replaces necessary conventional medical care
* That a treatment is a substitute for emergency care
* Specific therapeutic claims for named conditions without a verified,
  practitioner-approved source

### 3.2 Required framing

* General wellness information is presented as general information, never as
  individualized medical advice.
* Content that touches on treatment encourages consultation with a qualified
  practitioner.
* Content is reviewed by a qualified practitioner before publication. The CMS
  must support that review step rather than assuming it happened.

### 3.3 Emergency guidance

Any surface where a user might describe an acute problem — contact forms,
symptom fields, chat, appointment reason-for-visit — carries clear guidance to
seek immediate medical attention in an emergency, rather than waiting for a
clinic response. The platform is not an emergency channel and must never
present itself as one.

### 3.4 Tone

Responsible framing is not the same as timid framing. Ayurveda can be
described with confidence, specificity and respect for its tradition. The line
is between *describing a practice* and *promising an outcome*.

---

## 4. Patient Data in a Clinical Context

Reinforcing `SECURITY.md` and `DATABASE.md`, because these are the rules most
often broken by accident:

* Patient-identifying and clinical information never appears in URLs, query
  parameters, analytics events, error messages or browser console output.
* Server logs record identifiers and correlation IDs, never clinical content.
* Notification payloads carry the minimum needed — time and place, not
  diagnosis. Notifications appear on lock screens and in third-party inboxes.
* Sample and test data is synthetic. Real patient data is never used for
  development, testing, demonstrations or debugging.

---

## 5. AI Safety — The Boundary

AI may eventually assist practitioners. The boundary is fixed:

> **AI assists. A qualified practitioner decides.**

### 5.1 AI must never autonomously

* Diagnose a patient
* Prescribe, adjust or discontinue any medicine
* Approve or finalize a treatment plan
* Write to a finalized clinical record
* Send medical advice directly to a patient without practitioner review
* Make any final clinical decision
* Triage a patient as low-risk, or decline urgency
* Determine appointment priority on clinical grounds

### 5.2 AI may assist a practitioner with

* Summarizing a patient's history or previous visits
* Surfacing potentially relevant prior information
* Drafting consultation notes for the practitioner to review and edit
* Suggesting questions the practitioner may wish to ask
* Producing patient-friendly explanations of a practitioner-authored plan
* Non-clinical operational work: scheduling text, content drafting, search

The distinction is consistent: AI may *organize and present* information a
practitioner already has, and may *draft* text a practitioner will review. It
may not originate clinical judgment.

---

## 6. Human Review Is Structural, Not Advisory

A note in a specification saying "the doctor should review this" is not a
control. Where AI produces clinical text, the system must make review
unavoidable:

* AI output enters the record as an explicitly marked **draft**.
* A draft cannot become part of the patient record without an affirmative
  action by the authenticated practitioner.
* The practitioner can edit freely before accepting; acceptance records who
  accepted, and when.
* There is no configuration, flag or bulk action that auto-accepts AI clinical
  output.
* Silence is never acceptance. An unreviewed draft expires as a draft.

---

## 7. Disclosure

* AI-generated or AI-assisted content is clearly labelled wherever a human
  reads it.
* Stored clinical records carry provenance: whether the content originated
  with AI, and which practitioner accepted it.
* Patients are told when they are interacting with an automated system.
* Labelling is visible and plain, not a tooltip or a footnote.

---

## 8. Data Minimization for AI

Sending a full patient record to a model because it is convenient is a privacy
failure, regardless of the provider's terms.

* Send the minimum information the task requires.
* Prefer de-identified input where the task permits it.
* Never send credentials, payment details or unrelated patients' data.
* AI provider calls are made **server-side only**. The provider key is never
  exposed to the browser (see `.env.example`, AI section).
* Prompts and responses involving patient data are subject to the same
  retention, logging and audit rules as any other clinical access — including
  an `audit_logs` entry recording that AI processed a given patient's record.
* Review and document the provider's data-retention and training-use terms
  before any patient data is sent. A provider that trains on submitted data is
  not acceptable for clinical content.

---

## 9. Safe Defaults

* AI features are **disabled by default** (`AI_FEATURES_ENABLED="false"`). A
  misconfigured or partially deployed environment must not silently enable AI
  in a clinical setting.
* When an AI call fails, times out or returns something unparseable, the
  feature degrades to the ordinary manual workflow. It never blocks care and
  never guesses.
* AI features ship behind a flag that can be switched off without a
  deployment.

---

## 10. Testing Obligations

AI and health-content behaviour is tested, not assumed. See `QA_STRATEGY.md`
§44. At minimum:

* AI-drafted clinical content cannot be persisted as final without an explicit
  practitioner action — verified by test, including via direct API call rather
  than only through the UI.
* Disclosure labelling is present wherever AI content is rendered.
* Failure and timeout paths degrade to the manual workflow.
* Prompt payloads contain only the intended minimal fields.
* No prohibited claim patterns appear in published content.

---

## 11. Responsibility

No AI feature, and no content change, removes a practitioner's professional
responsibility for clinical decisions. The platform's job is to make that
responsibility easier to exercise well — by presenting accurate information
clearly, marking what is uncertain, and never quietly substituting its own
judgment for a clinician's.
