/**
 * The clinic dashboard's section anchors.
 *
 * Declared once because two places depend on them agreeing: the dashboard
 * page, which puts each id on its panel, and the administration sidebar,
 * which links to them. A renamed id here moves both; a renamed id typed in
 * either place would leave a sidebar link that scrolls nowhere.
 */
export const CLINIC_DASHBOARD_PATH = "/admin/analytics";

export const CLINIC_DASHBOARD_IDS = {
  heading: "admin-analytics-heading",
  headline: "admin-analytics-headline",
  overview: "admin-analytics-overview",
  busiest: "admin-analytics-busiest",
  workload: "admin-analytics-workload",
  appointmentRegister: "admin-analytics-appointment-register",
  patients: "admin-analytics-patients",
  patientRegister: "admin-analytics-patient-register",
  activity: "admin-analytics-activity",
  notifications: "admin-analytics-notifications",
  clinical: "admin-analytics-clinical",
  export: "admin-analytics-export",
  definitions: "admin-analytics-definitions",
} as const;
