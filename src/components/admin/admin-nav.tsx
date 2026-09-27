"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Settings,
  Stethoscope,
  UsersRound,
  UserRoundCog,
} from "lucide-react";
import type { ReactNode } from "react";

import { NavLink } from "@/components/layout/nav-link";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { ADMIN_SHELL, ADMIN_USERS_PAGE } from "@/features/admin/content";
import {
  CLINIC_DASHBOARD_IDS,
  CLINIC_DASHBOARD_PATH,
} from "@/features/analytics/dashboard-sections";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * The administration navigation, in three groups.
 *
 * ## Pages and sections are different kinds of link
 *
 * "Clinic analytics" and "Access management" are pages, and the current one
 * is the filled row (`NavLink`'s sidebar appearance, `aria-current="page"`).
 * "Appointments", "Practitioners", "Patients" and "Clinical activity" are
 * *sections of the dashboard*, not pages of their own — the product has no
 * separate appointment or patient screens for an administrator, and inventing
 * them would be placeholder navigation. They are never marked current.
 *
 * ## A section link keeps the reporting period
 *
 * The period and practitioner live in the dashboard's query string. On the
 * dashboard, a section link is therefore a bare `#fragment`, which scrolls
 * without touching the query; anywhere else it is the dashboard path plus the
 * fragment, which opens the default period. That difference is why this is a
 * client component — it needs the pathname — and it is the only reason.
 *
 * ## One landmark
 *
 * The sidebar and the mobile sheet both render this, but only one is ever
 * displayed, so assistive technology meets a single "Administration"
 * navigation.
 */

interface PageEntry {
  readonly kind: "page";
  readonly label: string;
  readonly href: string;
  readonly icon: ReactNode;
}

interface SectionEntry {
  readonly kind: "section";
  readonly label: string;
  readonly sectionId: string;
  readonly icon: ReactNode;
}

type Entry = PageEntry | SectionEntry;

const GROUPS: readonly {
  readonly label: string;
  readonly entries: readonly Entry[];
}[] = [
  {
    label: ADMIN_SHELL.groups.analytics,
    entries: [
      {
        kind: "page",
        label: ADMIN_SHELL.clinicAnalytics,
        href: CLINIC_DASHBOARD_PATH,
        icon: <ChartColumn />,
      },
      {
        kind: "section",
        label: ADMIN_SHELL.sections.appointments,
        sectionId: CLINIC_DASHBOARD_IDS.overview,
        icon: <CalendarDays />,
      },
      {
        kind: "section",
        label: ADMIN_SHELL.sections.practitioners,
        sectionId: CLINIC_DASHBOARD_IDS.workload,
        icon: <Stethoscope />,
      },
      {
        kind: "section",
        label: ADMIN_SHELL.sections.patients,
        sectionId: CLINIC_DASHBOARD_IDS.patients,
        icon: <UsersRound />,
      },
      {
        kind: "section",
        label: ADMIN_SHELL.sections.clinical,
        sectionId: CLINIC_DASHBOARD_IDS.clinical,
        icon: <ClipboardList />,
      },
    ],
  },
  {
    label: ADMIN_SHELL.groups.administration,
    entries: [
      {
        kind: "page",
        label: ADMIN_USERS_PAGE.title,
        href: "/admin/users",
        icon: <UserRoundCog />,
      },
    ],
  },
  {
    label: ADMIN_SHELL.groups.workspace,
    entries: [
      {
        kind: "page",
        label: ADMIN_SHELL.notifications,
        href: "/notifications",
        icon: <Bell />,
      },
      {
        kind: "page",
        label: ADMIN_SHELL.settings,
        href: "/account",
        icon: <Settings />,
      },
    ],
  },
];

/** On the dashboard, a fragment; elsewhere, the dashboard and a fragment. */
export function sectionHref(pathname: string, sectionId: string): string {
  return pathname === CLINIC_DASHBOARD_PATH
    ? `#${sectionId}`
    : `${CLINIC_DASHBOARD_PATH}#${sectionId}`;
}

export function AdminNav({
  label,
  onNavigate,
}: {
  readonly label: string;
  /** Called after any link is followed — the mobile sheet closes on it. */
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <p
            aria-hidden="true"
            className="text-caption text-muted-foreground/80 px-3 font-sans font-semibold tracking-[0.12em] uppercase"
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.entries.map((entry) => (
              <li key={entry.label}>
                {entry.kind === "page" ? (
                  <NavLink
                    item={{ label: entry.label, href: entry.href }}
                    appearance="sidebar"
                    icon={entry.icon}
                    onClick={onNavigate}
                  />
                ) : (
                  <Link
                    href={sectionHref(pathname, entry.sectionId)}
                    onClick={onNavigate}
                    className={cn(
                      "text-label text-muted-foreground inline-flex min-h-11 w-full items-center gap-3 rounded-md px-3 font-sans font-medium",
                      MOTION_MICRO,
                      "hover:bg-accent hover:text-primary",
                      "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                      "[&_svg]:size-[1.125rem] [&_svg]:shrink-0",
                    )}
                  >
                    <span aria-hidden="true" className="contents">
                      {entry.icon}
                    </span>
                    {entry.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * The sidebar's closing card: where to find out what a figure means.
 *
 * It points at the dashboard's own metric definitions rather than at an
 * outside "help centre" — there is none, and a support link that goes
 * nowhere is worse than no card. Like the section links, it keeps the
 * reporting period when followed from the dashboard.
 */
export function AdminHelpCard() {
  const pathname = usePathname();

  return (
    <div className="bg-muted/70 relative overflow-hidden rounded-lg p-5">
      <LeafSprig sizes="96px" className="-mt-2 -ml-3 w-24 -rotate-12" />
      <p className="text-h5 text-heading mt-2 font-serif">
        {ADMIN_SHELL.help.title}
      </p>
      <p className="text-body-sm text-muted-foreground mt-1 font-sans">
        {ADMIN_SHELL.help.body}
      </p>
      <Link
        href={sectionHref(pathname, CLINIC_DASHBOARD_IDS.definitions)}
        className={cn(
          "border-border-strong bg-card text-label text-foreground mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-sans font-medium",
          MOTION_MICRO,
          "hover:border-primary/40 hover:text-primary",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      >
        {ADMIN_SHELL.help.action}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
