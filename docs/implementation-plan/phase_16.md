# Phase 16 — Analytics & Reporting

## 1. Phase Objective

Build a secure, performant, and privacy-conscious **Analytics & Reporting** system for Punarvasu.

The system should provide authorized clinic users with actionable insights into:

* appointments
* scheduling utilization
* patient growth
* practitioner workload
* appointment outcomes
* cancellations/no-shows
* operational performance
* prescription/treatment activity at an appropriate aggregate level
* notification delivery performance
* clinic trends

The goal is to help Punarvasu understand and improve clinic operations without turning analytics into an uncontrolled repository of patient clinical information.

---

# 2. Core Principle

Analytics should answer:

```text
How is the clinic operating?
```

not:

```text
What sensitive medical information can we collect about patients?
```

Prefer:

```text
Aggregated operational data
```

over:

```text
Raw clinical data
```

---

# 3. Privacy-First Analytics

Do NOT use analytics as a reason to expose or duplicate:

* diagnoses
* symptoms
* doctor notes
* clinical observations
* laboratory results
* detailed prescriptions
* treatment instructions
* uploaded documents
* sensitive patient history

unless a specific, documented, authorized reporting requirement exists.

---

# 4. Architecture Boundary

Phase 16 consumes authoritative information from:

```text id="w9j2p7"
Phase 07
Patient Profile
        ↓
Phase 09
Appointments
        ↓
Phase 10
Receptionist Operations
        ↓
Phase 11
Doctor Workspace
        ↓
Phase 12
Clinical Records
        ↓
Phase 13
Prescriptions / Treatment Plans
        ↓
Phase 14
Documents
        ↓
Phase 15
Notifications
        ↓
Phase 16
Analytics & Reporting
```

Analytics must be read-only with respect to these domain systems.

---

# 5. Analytics Must Not Become a Second Source of Truth

Bad:

```text id="h2n8q4"
Appointment
→ analytics table
→ dashboard edits analytics row
→ appointment changes
```

Good:

```text id="m7q3x9"
Appointment database
→ reporting query/view
→ analytics dashboard
```

Analytics should derive from authoritative domain state.

---

# 6. Roles

Analytics access must be explicitly permissioned.

Recommended:

### Admin

Full operational analytics.

### Receptionist

Operational scheduling analytics appropriate to their role.

### Doctor

Only analytics appropriate to their authorized clinic/practitioner scope.

### Patient

No internal clinic analytics.

A patient may see personal activity/history, but that is a product experience rather than internal clinic analytics.

---

# 7. Permission Model

Potential permissions:

```text id="p8x4m2"
analytics.read
analytics.read.operational
analytics.read.practitioner
analytics.read.financial
reports.export
```

Use the existing Phase 08 authorization model.

Do not introduce a separate analytics role system.

---

# 8. Role vs Scope

A doctor being a doctor does not automatically mean:

```text id="k3m8q1"
doctor → all clinic analytics
```

The analytics scope must follow the existing practitioner authorization model.

For example:

```text id="q7x2m4"
Doctor A
→ own authorized workload

Admin
→ clinic-wide operational metrics
```

The exact scope must follow product requirements.

---

# 9. Dashboard Types

Potential dashboards:

```text id="v6n3x8"
Clinic Overview
Appointment Analytics
Practitioner Analytics
Patient Growth
Notification Analytics
Operational Reports
```

Do not create dashboards that have no operational purpose.

---

# 10. Clinic Overview

A clinic overview may show:

* total appointments
* confirmed appointments
* completed appointments
* cancelled appointments
* no-shows
* appointment utilization
* new patients
* returning patients
* appointment trends

Use appropriate date filters.

---

# 11. Avoid KPI Overload

Do not create a dashboard containing:

```text id="f4m8x2"
20+ KPI cards
```

Prefer a small set of high-value metrics.

Example:

```text id="x7q3m9"
Today's Appointments
Completed
Cancelled
No-show
New Patients
```

followed by meaningful trends.

---

# 12. Appointment Analytics

Support metrics such as:

```text id="m8q4x7"
appointments created
appointments confirmed
appointments completed
appointments cancelled
appointments no-show
```

---

# 13. Appointment Trend

Example:

```text id="q3x7m2"
Appointments
│
│       ╭──╮
│   ╭───╯  ╰──╮
│───╯         ╰──
└────────────────
```

Use charts only when they help identify trends.

---

# 14. Cancellation Rate

Calculate:

```text id="v5m2q8"
cancellation rate
=
cancelled appointments
/
eligible appointments
```

Define the denominator explicitly.

Do not casually mix:

* cancelled
* completed
* no-show
* pending

without documenting the calculation.

---

# 15. No-Show Rate

Potential:

```text id="x8q4m3"
no-show rate
=
no-show appointments
/
eligible appointments
```

Define whether cancelled appointments are excluded.

---

# 16. Completion Rate

Potential:

```text id="m7x3q8"
completion rate
=
completed appointments
/
eligible appointments
```

Document the exact calculation.

---

# 17. Utilization

Practitioner utilization should be based on the clinic's scheduling model.

Potential:

```text id="q8m4x2"
booked eligible time
/
available eligible time
```

Do not calculate utilization using arbitrary assumptions.

Use Phase 09 availability rules.

---

# 18. Availability Analytics

Where data permits:

* available hours
* booked hours
* blocked hours
* utilization
* unfilled slots

Do not invent availability.

---

# 19. Practitioner Analytics

Authorized staff may see:

* appointment volume
* completion rate
* cancellation rate
* no-show rate
* utilization
* workload trend

Avoid exposing clinical performance metrics that have not been explicitly defined.

---

# 20. Practitioner Comparison

If clinic management needs comparison:

```text id="m3q7x8"
Doctor A
Doctor B
Doctor C
```

compare operational metrics only.

Do not rank doctors based on:

* diagnosis outcomes
* prescription patterns
* patient medical conditions

unless a formally approved clinical-quality reporting system is later introduced.

---

# 21. Patient Growth

Potential metrics:

* total registered patients
* new patients
* returning patients
* active patients
* patient growth trend

Define "active patient" clearly before implementation.

---

# 22. New Patient Definition

Do not assume:

```text id="x4m8q2"
created account = new clinical patient
```

unless product requirements define it that way.

Prefer domain-specific definitions.

---

# 23. Returning Patient

A returning patient may be defined as a patient with more than one completed/eligible appointment.

Document the exact rule.

---

# 24. Date Filters

Support useful filters:

```text id="q8x3m7"
Today
This week
This month
Last month
Last 3 months
Custom range
```

Do not allow unlimited expensive queries without controls.

---

# 25. Timezone

Analytics date boundaries must use the clinic's configured timezone.

Avoid:

```text id="m4x8q2"
new Date().toISOString().slice(0, 10)
```

as a universal business-date rule.

Use the timezone architecture established in Phase 09.

---

# 26. Date Range Validation

Validate:

* start date
* end date
* maximum supported range
* valid ordering

Avoid expensive unrestricted historical queries.

---

# 27. Trend Granularity

Choose granularity based on range.

Example:

```text id="x7m3q8"
1 week
→ daily

3 months
→ weekly

1 year
→ monthly
```

Avoid plotting thousands of individual data points unnecessarily.

---

# 28. Aggregation

Prefer database aggregation.

Bad:

```text id="q3m8x2"
Fetch 500,000 appointments
→ browser
→ JavaScript counts them
```

Good:

```text id="m7x4q8"
Database
→ aggregate
→ dashboard receives summary
```

---

# 29. Database Views / RPC

Where appropriate, use:

* SQL views
* materialized views
* RPC functions
* aggregate queries

for analytics.

Choose based on actual performance requirements.

---

# 30. Analytics Read Models

If reporting queries become complex, create dedicated read models.

Conceptually:

```text id="x8m2q4"
Operational Tables
        ↓
Reporting Views / Aggregates
        ↓
Analytics API
        ↓
Dashboard
```

Do not duplicate entire domain tables.

---

# 31. Materialized Views

Use materialized views only when justified.

Potential candidates:

* daily appointment metrics
* practitioner utilization
* monthly patient growth

Refresh strategy must be defined.

Do not add materialized views simply for architectural appearance.

---

# 32. Real-Time Analytics

Do not require realtime analytics unless operationally useful.

Dashboards can refresh on:

* page load
* filter change
* explicit refresh
* periodic interval where appropriate

---

# 33. Caching

Analytics can potentially use short-lived caching because they are aggregated.

However:

* access must remain authorized
* patient-level data must not be publicly cached
* cache keys must include relevant scope
* date range must be included
* role/scope must be included where necessary

---

# 34. Cache Isolation

Bad:

```text id="q4m8x7"
cache key = "analytics"
```

Good:

```text id="m8x3q2"
analytics:{scope}:{dateRange}:{filters}
```

or equivalent secure architecture.

---

# 35. Patient-Level Reporting

Avoid exposing identifiable patient lists in general analytics.

If an operational report needs patient information, it must be explicitly authorized.

Prefer:

```text id="x7q4m8"
32 appointments
```

over:

```text id="m3x8q2"
32 rows containing patient name + clinical data
```

---

# 36. Clinical Analytics

Clinical analytics are out of scope for general Phase 16.

Do not build:

* diagnosis frequency dashboards
* disease prevalence dashboards
* medicine effectiveness dashboards
* clinical outcome rankings
* treatment efficacy claims

unless the clinic has formally specified and approved these requirements.

---

# 37. Prescription Analytics

At most, operational aggregate metrics may be considered:

* prescriptions issued count
* prescriptions by period
* treatment plans created

Do not expose medicine-level prescribing patterns by default.

---

# 38. Treatment Plan Analytics

Potential:

```text id="q5m8x3"
active treatment plans
completed treatment plans
plans created over time
```

Avoid interpreting these as treatment efficacy.

---

# 39. Document Analytics

Potential operational metrics:

```text id="x2m7q8"
documents uploaded
documents by type
upload volume
```

Do not expose:

* document contents
* medical report values
* diagnosis from documents

---

# 40. Notification Analytics

Phase 15 can provide:

* notifications queued
* sent
* delivered
* failed
* delivery rate
* channel usage

Do not expose message content.

---

# 41. Delivery Rate

Clearly distinguish:

```text id="m8q3x7"
sent
delivered
failed
```

Do not calculate "delivery rate" from `sent` if the provider does not confirm delivery.

---

# 42. Provider Analytics

Where available:

```text id="x4m7q2"
Email
SMS
WhatsApp
```

can be compared operationally.

Do not expose provider credentials or sensitive payloads.

---

# 43. Report Export

If exporting reports:

support safe formats appropriate to requirements.

Potential:

```text id="q7m3x8"
CSV
XLSX
PDF
```

Do not automatically include patient-identifying information.

---

# 44. Export Authorization

Export permissions must be stronger than simply viewing a dashboard if appropriate.

Potential:

```text id="m4x8q2"
analytics.read
≠
reports.export
```

Use the Phase 08 permission system.

---

# 45. Export Data Minimization

Exports should contain only the fields required.

Bad:

```text id="x8q3m7"
Export appointments
→ includes internal notes
→ includes clinical record
→ includes prescription details
```

Good:

```text id="q3m7x8"
Export appointment operations
→ date
→ appointment type
→ status
→ practitioner
```

where appropriate.

---

# 46. Export Filename

Avoid putting sensitive patient information into filenames.

Use:

```text id="m8x4q2"
punarvasu-appointments-2026-09.csv
```

rather than patient-specific information.

---

# 47. Export Security

Exports are sensitive.

Do not create:

```text id="x7m3q8"
public download URL
```

Use authenticated server-side generation and secure delivery.

---

# 48. Export Auditability

Where audit infrastructure exists, record:

```text id="q4m8x2"
who exported
what report
when
scope
```

Do not log the full exported dataset.

---

# 49. Patient Personal Statistics

If the patient portal includes personal analytics, keep them strictly self-scoped.

Potential:

```text id="m7x2q8"
My appointments
My upcoming appointments
My completed visits
My prescriptions
My documents
```

This is not a clinic-wide analytics dashboard.

---

# 50. Patient Privacy

Patients must never see:

* other patient counts that enable sensitive inference
* doctor workload that is private
* clinic operational reports
* internal performance data

unless intentionally designed.

---

# 51. Dashboard Scope

Every analytics query should have an explicit scope.

Conceptually:

```ts id="x3m8q7"
AnalyticsScope {
  organizationId
  practitionerId?
  locationId?
}
```

Use the actual project's tenancy/scope model.

Do not hard-code a clinic ID.

---

# 52. Multi-Clinic Readiness

If Punarvasu may later support multiple clinics/locations, avoid architectures that assume:

```text id="q7m4x8"
one hard-coded clinic
```

However, do not build full multi-tenancy unless required.

Keep the data model extensible.

---

# 53. Organization Scope

If an organization/clinic model already exists, all analytics must be scoped to it.

Cross-organization data leakage must be impossible.

---

# 54. Practitioner Scope

Where practitioner analytics are allowed:

```text id="m8q3x7"
authenticated doctor
→ own permitted scope
```

not:

```text id="x4m7q2"
doctor
→ all doctors
```

unless explicitly authorized.

---

# 55. RLS

Analytics queries must respect underlying RLS where appropriate.

If privileged reporting functions bypass normal RLS, they must implement equivalent explicit authorization and be server-only.

Do not create a broad service-role analytics endpoint.

---

# 56. SECURITY DEFINER

If PostgreSQL `SECURITY DEFINER` functions are used:

* explicitly control `search_path`
* validate inputs
* authorize callers
* avoid dynamic SQL injection
* grant execution narrowly
* never expose unrestricted access

---

# 57. SQL Injection

Date/filter/report parameters must be parameterized.

Never construct:

```sql id="q7m3x8"
'... WHERE date >= ' + userInput
```

Use parameterized queries/functions.

---

# 58. Filter Validation

Validate:

* date ranges
* practitioner IDs
* appointment types
* statuses
* document types
* notification channels

Never accept arbitrary SQL fragments or column names from the client.

---

# 59. Patient Enumeration

Analytics endpoints must not become an enumeration API.

Bad:

```text id="m4x8q2"
/api/analytics?patientId=...
```

returning arbitrary patient information.

---

# 60. Analytics API

Prefer purpose-built endpoints/functions such as:

```text id="x7q3m8"
getAppointmentSummary()
getAppointmentTrend()
getPractitionerUtilization()
getPatientGrowth()
getNotificationDeliverySummary()
```

rather than:

```text id="m8x2q4"
GET /analytics/raw-table
```

---

# 61. Raw Data Endpoint

Do not expose generic database querying.

Never implement:

```text id="q4m7x8"
POST /api/query
{
  "table": "appointments",
  "where": "..."
}
```

---

# 62. Chart Data

Return only data required for the chart.

Example:

```json id="x8m3q7"
{
  "date": "2026-09-14",
  "appointments": 12
}
```

not entire appointment rows.

---

# 63. Dashboard Loading

Use appropriate:

* skeletons
* loading indicators
* partial loading
* error states

Do not block the entire dashboard unnecessarily.

---

# 64. Empty Analytics

Example:

```text id="m7x4q8"
No appointment data is available for this period.
```

Do not display:

```text id="x3q8m2"
0%
```

without explaining whether that means no data or zero activity.

---

# 65. Error State

Use:

```text id="q8m3x7"
We couldn't load this report.
Please try again.
```

Do not expose SQL errors.

---

# 66. Chart Accessibility

Charts must have:

* accessible titles
* useful summaries
* keyboard-accessible controls
* tabular alternative where necessary
* non-color-dependent meaning

Do not rely only on hover tooltips.

---

# 67. Chart Color

Use the Punarvasu design system.

Do not use dozens of arbitrary colors.

Maintain visual consistency.

---

# 68. Chart Selection

Use:

### Line chart

For trends.

### Bar chart

For comparisons.

### Donut/pie

Only for simple proportions.

Avoid charts when a simple number/table communicates better.

---

# 69. Data Tables

For exact values, provide tables.

Example:

```text id="x7m2q8"
Practitioner | Appointments | Completed | Cancelled
```

This is often more useful than a chart alone.

---

# 70. Tooltips

Tooltips should supplement, not replace, visible labels.

---

# 71. Responsive Analytics

Desktop dashboards may use:

```text id="m4x8q2"
cards
charts
tables
```

Mobile should reorganize rather than shrink desktop charts into unreadable dimensions.

---

# 72. Mobile Dashboard

Prioritize:

```text id="q7m3x8"
Key metrics
↓
Trend
↓
Important breakdown
```

Avoid showing a huge grid of tiny charts.

---

# 73. Date Filter UX

Provide:

* clear current range
* timezone-aware labels
* reset filter
* loading feedback
* validation

---

# 74. Filter Persistence

If filter persistence is implemented, do not store sensitive patient data.

Persist only harmless preferences such as:

```text id="x8m4q2"
dateRange
selected practitioner
chart preference
```

and validate them server-side.

---

# 75. Analytics Refresh

Provide an explicit refresh control if reports are not realtime.

Example:

```text id="m7x3q8"
Last updated 2 minutes ago
[Refresh]
```

Do not claim realtime accuracy when data is cached or aggregated.

---

# 76. Data Freshness

Where reports use delayed aggregates, clearly communicate freshness.

Example:

```text id="q4m8x7"
Updated today at 09:15
```

---

# 77. Historical Corrections

If appointments are corrected later, analytics should reflect authoritative data after the next query/refresh/aggregate update.

Do not permanently store incorrect metrics without a correction strategy.

---

# 78. Materialized Data Refresh

If materialized views are used:

* document refresh frequency
* ensure dashboard labels reflect freshness
* handle refresh failure
* avoid presenting stale numbers as realtime

---

# 79. Analytics Performance

Do not run expensive aggregation on every page interaction if avoidable.

Use:

* proper indexes
* database aggregation
* bounded date ranges
* materialized views where justified
* caching where safe

---

# 80. Index Strategy

Potential source indexes:

```text id="x7m3q8"
appointments.start_at
appointments.status
appointments.practitioner_id
appointments.patient_id
appointments.created_at
notifications.created_at
notifications.status
notifications.channel
prescriptions.issued_at
patient_profiles.created_at
```

Only add indexes supported by actual query patterns.

---

# 81. N+1 Queries

Avoid:

```text id="m8q4x2"
Get practitioners
→ query appointments per practitioner
→ query again per practitioner
```

Prefer aggregate queries.

---

# 82. Query Limits

All analytics endpoints should have bounded filters.

Avoid:

```text id="q3x7m8"
all-time unlimited raw data
```

unless specifically designed and optimized.

---

# 83. Export Limits

Large exports should use:

* streaming
* background generation
* pagination
* explicit limits

as appropriate.

Do not load huge datasets into browser memory.

---

# 84. Report Generation

If reports are generated server-side:

```text id="x8m3q7"
Authorize
→ validate
→ query aggregate data
→ generate report
→ secure delivery
```

---

# 85. Report Formats

Implement only formats actually required.

If XLSX/PDF exports are needed, use the project's established artifact/document tooling where appropriate.

Do not create a massive reporting engine.

---

# 86. Notification Analytics

Use Phase 15 delivery states.

Potential metrics:

```text id="m7q3x8"
queued
sent
delivered
failed
```

Do not derive delivery from UI display state.

---

# 87. Prescription Analytics Privacy

If reporting on prescriptions:

prefer:

```text id="q8m4x2"
number of prescriptions issued
```

over:

```text id="x3m7q8"
doctor's complete prescription history
```

unless specifically authorized.

---

# 88. Clinical Data Isolation

Do not query sensitive clinical fields simply because they exist.

Avoid selecting:

```text id="m4x8q2"
diagnosis
doctor_notes
clinical_observations
```

for ordinary analytics.

---

# 89. Data Minimization

Analytics queries should select only required fields.

Bad:

```sql id="x7m3q8"
SELECT *
```

Good:

```sql id="q4x8m2"
SELECT date, count(*)
```

---

# 90. Patient Identifiers

Avoid exposing patient names in analytics.

Use aggregate counts whenever possible.

If a report genuinely needs patient identifiers, it must be a separately authorized operational report.

---

# 91. Reporting vs Analytics

Keep distinction:

### Analytics

Interactive trends and aggregate dashboards.

### Reports

Defined operational outputs, potentially exportable.

Both must use the same authorization and privacy rules.

---

# 92. Report Definitions

Document each report:

```text id="m8q3x7"
Name
Purpose
Audience
Data source
Filters
Calculation
Permissions
Export fields
```

This prevents ambiguous reporting.

---

# 93. Metric Definitions

Create a centralized definition for important metrics.

Example:

```text id="x7m4q2"
Completed Appointments
=
appointments.status = 'completed'
```

Do not duplicate calculations in:

* SQL
* API
* frontend
* export code

---

# 94. Metric Consistency

The number shown on:

```text id="q8m3x7"
dashboard
```

should match:

```text id="m4x7q2"
report
```

when filters and definitions are the same.

---

# 95. Rounding

Define rounding rules.

Example:

```text id="x3m8q7"
utilization = 67.4%
```

Use consistent formatting.

Do not show:

```text id="q7m3x8"
67.437291%
```

in the normal UI.

---

# 96. Zero vs Missing

Distinguish:

```text id="m8x4q2"
0 appointments
```

from:

```text id="x7q3m8"
Data unavailable
```

This is important for trustworthy analytics.

---

# 97. Data Quality

Analytics should identify impossible states where practical.

Examples:

```text id="q4m8x7"
completed appointments > total appointments
```

or:

```text id="m3x7q8"
negative utilization
```

These indicate data/query bugs.

---

# 98. Analytics Tests

Test metric calculations using deterministic fixtures.

For example:

```text id="x8m4q2"
10 appointments
6 completed
2 cancelled
1 no-show
1 pending
```

Verify each metric.

---

# 99. Date Boundary Tests

Test:

* midnight
* timezone conversion
* start date inclusive
* end date inclusive/exclusive
* month boundary
* year boundary
* DST if applicable to supported regions

---

# 100. Authorization Tests

Test:

```text id="m7q3x8"
Admin → clinic analytics = ALLOW
Receptionist → allowed operational analytics = ALLOW
Doctor → permitted scope = ALLOW
Doctor → unauthorized clinic-wide analytics = DENY
Patient → internal analytics = DENY
```

---

# 101. IDOR Tests

Attempt:

```text id="x4m8q2"
change practitionerId
change clinicId
change reportId
change exportId
```

Expected:

```text id="q7m3x8"
DENIED
```

---

# 102. Scope Tests

If Doctor A is allowed only their own analytics:

```text id="m8x3q7"
Doctor A
→ Doctor A metrics = ALLOW
Doctor A
→ Doctor B metrics = DENY
```

---

# 103. Export Security Tests

Verify:

```text id="x7m4q8"
unauthorized export = DENIED
authorized export = ALLOW
export contains only permitted fields
export is not publicly accessible
```

---

# 104. Data Leakage Tests

Ensure analytics API responses do not accidentally contain:

* patient names
* emails
* phone numbers
* diagnosis
* clinical notes
* prescription details
* storage paths
* document URLs

unless explicitly required.

---

# 105. SQL Security Tests

If custom SQL/RPC exists, test:

* SQL injection
* invalid filters
* invalid IDs
* excessive date range
* unauthorized function invocation

---

# 106. Performance Tests

Measure representative queries.

Test:

* 1 week
* 3 months
* 1 year

and realistic clinic data volume.

Avoid premature optimization but identify slow queries before production.

---

# 107. Few-Shot Examples

## Example 1 — Dashboard Query

### Bad

```text id="n4m8q2"
Fetch all appointments
→ send to browser
→ calculate everything in React
```

### Good

```text id="x7q3m8"
Database
→ aggregate appointments
→ return small chart dataset
→ render dashboard
```

---

## Example 2 — Clinical Privacy

### Bad

```sql id="m8x4q2"
SELECT diagnosis, doctor_notes
FROM clinical_records
```

for a general appointment dashboard.

### Good

```sql id="q3m7x8"
SELECT status, count(*)
FROM appointments
GROUP BY status
```

---

## Example 3 — Doctor Scope

### Bad

```ts id="x8m3q7"
if (role === "doctor") {
  return clinicAnalytics;
}
```

### Good

```text id="m4q8x2"
Doctor
→ resolve authorized practitioner scope
→ aggregate only permitted data
```

---

## Example 4 — Export

### Bad

```text id="q7x3m8"
Export dashboard
→ dump every joined table
```

### Good

```text id="m8q4x2"
Export Appointment Report
→ explicitly defined columns
→ authorized scope
→ secure generated file
```

---

## Example 5 — Caching

### Bad

```text id="x4m7q8"
cache("analytics")
```

for every user.

### Good

```text id="q8m3x7"
scope + date range + authorized filters
→ isolated cache
```

---

## Example 6 — Date Range

### Bad

```text id="m7x4q2"
User enters 2010-01-01
→ query everything until today
```

### Good

```text id="x3q8m7"
Validate maximum supported range
→ bounded aggregation
```

---

## Example 7 — Zero vs Missing

### Bad

```text id="q4m8x2"
No data
→ show 0%
```

### Good

```text id="m8x3q7"
No records exist for this period.
```

---

## Example 8 — Notification Analytics

### Bad

```text id="x7m3q8"
Show full notification body and recipient details.
```

### Good

```text id="q8m4x2"
Email
Sent: 320
Delivered: 301
Failed: 19
```

---

## Example 9 — Patient Privacy

### Bad

```text id="m4x8q2"
Analytics dashboard:
Patient Name | Diagnosis | Prescription
```

### Good

```text id="x7q3m8"
Clinic dashboard:
Appointments | Completion | Cancellation | No-show
```

---

## Example 10 — Metric Consistency

### Bad

```text id="q8m3x7"
Dashboard calculates completion one way.
Export calculates it differently.
```

### Good

```text id="m7x4q2"
Central metric definition
→ dashboard
→ API
→ export
```

---

# 108. Expected Architectural Areas

Adapt to the actual repository.

Potential:

```text id="x4m8q2"
src/
  app/
    admin/
      analytics/
        page.tsx
    receptionist/
      analytics/
    doctor/
      analytics/

  components/
    analytics/
      metric-card.tsx
      chart-card.tsx
      date-range-filter.tsx
      analytics-table.tsx
      empty-state.tsx

  server/
    analytics/
      queries.ts
      authorization.ts
      metrics.ts
      reports.ts
      exports.ts

  lib/
    analytics/
      types.ts
      metric-definitions.ts
      formatters.ts
```

Do not blindly create this structure.

Follow the existing architecture.

---

# 109. Database Architecture

Prefer reporting queries over duplicated domain data.

Potential:

```text id="q7m3x8"
SQL views
RPC functions
aggregate queries
materialized views
```

Use only what is justified.

---

# 110. API Architecture

Create purpose-built read APIs.

Examples:

```text id="m8x4q2"
GET appointment summary
GET appointment trend
GET practitioner workload
GET patient growth
GET notification delivery summary
```

Use the project's established route/server-action conventions.

---

# 111. Authorization Layer

Analytics queries should have explicit authorization functions.

Potential:

```text id="x3q7m8"
requireAnalyticsAccess()
requirePractitionerAnalyticsAccess()
requireExportPermission()
```

Use existing Phase 08 primitives.

---

# 112. Metric Layer

Centralize metric definitions.

Potential:

```text id="q8m4x2"
appointmentMetrics.ts
patientMetrics.ts
notificationMetrics.ts
```

The actual organization should follow the repository.

---

# 113. No Frontend Business Logic

Do not calculate authoritative metrics only in React.

Frontend may format:

```text id="m7x3q8"
67.4%
```

but the underlying metric must come from a trusted server/data layer.

---

# 114. Report Exports

If exports are implemented:

* server-side generation
* explicit columns
* explicit permissions
* bounded range
* safe filenames
* no public URLs

---

# 115. Accessibility

Analytics must support:

* keyboard navigation
* screen readers
* accessible charts
* table alternatives
* clear labels
* focus management
* non-color-dependent status

---

# 116. Responsive Design

Use the Punarvasu design system.

Avoid generic SaaS dashboard aesthetics.

The dashboard should feel:

* calm
* professional
* uncluttered
* information-dense without being overwhelming

---

# 117. Motion

Use subtle motion only.

Respect:

```text id="x7m4q8"
prefers-reduced-motion
```

Do not animate charts excessively.

---

# 118. Performance

Analytics pages should:

* query aggregate data
* avoid N+1
* avoid SELECT *
* use bounded ranges
* paginate tables
* lazy-load secondary reports
* use appropriate caching

---

# 119. Security

Do not expose:

* service-role keys
* SQL queries
* raw database errors
* storage paths
* patient clinical information
* provider secrets

---

# 120. Acceptance Criteria

Phase 16 is complete only when:

## Analytics

* [ ] Authorized analytics dashboard exists.
* [ ] Role-based analytics access works.
* [ ] Practitioner scope is enforced.
* [ ] Appointment metrics work.
* [ ] Appointment trends work.
* [ ] Cancellation metrics work.
* [ ] No-show metrics work.
* [ ] Completion metrics work.
* [ ] Patient growth metrics work where defined.
* [ ] Notification delivery metrics work where applicable.
* [ ] Prescription/treatment aggregate metrics exist only where justified.

## Metrics

* [ ] Metric definitions are centralized.
* [ ] Dashboard and report calculations are consistent.
* [ ] Zero vs missing data is handled correctly.
* [ ] Date boundaries are correct.
* [ ] Timezone is correct.
* [ ] Date ranges are bounded.
* [ ] Aggregations happen server/database side.

## Authorization

* [ ] Admin access is correct.
* [ ] Receptionist scope is correct.
* [ ] Doctor scope is correct.
* [ ] Patient cannot access internal analytics.
* [ ] IDOR tests pass.
* [ ] Clinic/practitioner scope cannot be manipulated.

## Privacy

* [ ] General analytics do not expose clinical notes.
* [ ] Diagnoses are not unnecessarily queried.
* [ ] Prescription details are not unnecessarily exposed.
* [ ] Document contents are not exposed.
* [ ] Patient identifiers are minimized.
* [ ] Sensitive data is not logged.
* [ ] Analytics responses contain only required fields.

## Reports

* [ ] Required reports exist.
* [ ] Export permissions are enforced.
* [ ] Exports contain only approved fields.
* [ ] Exports are securely generated.
* [ ] No public export URLs exist.

## Performance

* [ ] Analytics queries are bounded.
* [ ] No major N+1 queries exist.
* [ ] Appropriate indexes exist.
* [ ] Large datasets are aggregated server-side.
* [ ] Dashboard load is acceptable.

## UX

* [ ] Dashboard is responsive.
* [ ] Charts are accessible.
* [ ] Tables are readable.
* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Date filtering works.
* [ ] Punarvasu design system is used.

## Engineering

* [ ] Phase 08 authorization is reused.
* [ ] Phase 09 appointment definitions are reused.
* [ ] Phase 15 notification delivery states are reused.
* [ ] No duplicate domain state is introduced.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 121. Mandatory Security Verification

Attempt:

```text id="x7m3q8"
Doctor A → Doctor B analytics
Doctor → clinic-wide analytics without permission
Patient → internal analytics
User A → User B report
User → another clinic scope
User → arbitrary practitionerId
User → arbitrary reportId
User → unauthorized export
```

Expected:

```text id="m8q4x2"
DENIED
```

---

# 122. Mandatory Privacy Verification

Inspect analytics API responses and verify they do not accidentally contain:

```text id="q3m7x8"
patient names
emails
phone numbers
diagnoses
clinical notes
prescription instructions
document storage paths
signed URLs
provider secrets
```

unless explicitly required and authorized.

---

# 123. Mandatory Performance Verification

Test representative datasets and date ranges.

At minimum:

```text id="x8m3q7"
1 week
3 months
1 year
```

Verify queries remain bounded and aggregate at the database layer.

---

# 124. Definition of Done

Phase 16 is done when authorized Punarvasu staff can answer questions such as:

```text id="m7q4x8"
How many appointments did we have this month?
How many were completed?
How many were cancelled?
How many were no-shows?
How is appointment volume trending?
How is practitioner workload trending?
How many new patients joined?
How are notifications being delivered?
```

without exposing unnecessary clinical information.

The system must preserve:

```text id="x3m8q7"
Operational Analytics
        ≠
Clinical Record
        ≠
Patient Document
        ≠
Notification Content
```

Analytics must remain read-only with respect to core clinical/operational domain state.

---

# 125. Explicitly Out of Scope

Do NOT implement:

* clinical outcome analytics
* diagnosis analytics
* disease prevalence analytics
* medicine effectiveness analysis
* automated clinical quality scoring
* AI-generated insights
* predictive analytics
* patient risk scoring
* automated diagnosis
* autonomous recommendations
* marketing campaign analytics
* financial accounting unless explicitly required
* full BI/data warehouse
* arbitrary SQL reporting interface

Phase 17 owns AI Clinical Decision Support.

---

# 126. Final Verification

Run:

```text id="q8m3x7"
lint
typecheck
tests
production build
```

Then manually verify:

```text id="m7x4q2"
Admin
→ Analytics
→ choose date range
→ view appointment metrics
→ view trend
→ view practitioner breakdown
→ refresh
```

Verify:

```text id="x3q8m7"
Doctor
→ permitted analytics
→ cannot access unauthorized practitioner/clinic analytics
```

Verify:

```text id="q7m3x8"
Patient
→ cannot access internal clinic analytics
```

Verify exports:

```text id="m8x4q2"
Authorized user
→ Export
→ secure file
→ only approved columns
```

Verify privacy:

```text id="x7m3q8"
Analytics API
→ no clinical notes
→ no diagnosis
→ no document content
→ no signed URLs
```

---

# 127. Completion Report

At completion, report:

## Implemented

* Analytics dashboards
* Metrics
* Date filters
* Charts
* Tables
* Practitioner analytics
* Patient growth
* Notification analytics
* Reports
* Exports

## Metric Definitions

Report each major metric:

```text id="q4m8x2"
Metric:
Formula:
Date semantics:
Timezone:
Scope:
```

## Database

Report:

```text id="m7x3q8"
Views:
RPCs:
Materialized views:
Indexes:
Aggregate queries:
```

## Authorization

Report:

```text id="x8m4q2"
Admin:
Receptionist:
Doctor:
Patient:
Practitioner scope:
Export permission:
```

## Privacy

Report:

```text id="q3m8x7"
Clinical data excluded:
Patient identifiers minimized:
Logging:
Caching:
Export protection:
```

## Performance

Report:

```text id="m4x7q2"
Representative query performance:
1-week:
3-month:
1-year:
N+1 issues:
Indexes:
Caching:
```

## Verification

```text id="x7m3q8"
Lint:
Typecheck:
Tests:
Build:
```

## Deferred

List intentionally deferred:

* clinical analytics
* predictive analytics
* AI insights
* advanced BI
* financial reporting
* marketing analytics
* other future work

## Phase Status

```text id="q8m3x7"
Phase 16: COMPLETE
Ready for Phase 17: YES/NO
```

Do not begin Phase 17 during this phase.
