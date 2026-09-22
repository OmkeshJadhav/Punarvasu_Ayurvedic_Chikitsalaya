import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ADMIN_AREA, ADMIN_USERS_PAGE } from "@/features/admin/content";

/**
 * The administration overview.
 *
 * ## Deliberately almost empty
 *
 * One card, because there is one administrative capability: access
 * management. `phase_08.md` sections 22 and 39 rule out building a staff
 * management product or an admin dashboard in this phase, and `AGENTS.md`
 * section 3 rules out placeholder functionality that makes a phase look
 * complete.
 *
 * So instead of a grid of disabled tiles for services, availability, content
 * and reporting, the page says in a sentence that access management is the
 * only thing built. A disabled tile is a promise; a sentence is the truth.
 *
 * No guard here: the layout above holds it, and repeating the check per page
 * would invite the reading that each page is responsible for its own
 * protection.
 */
export const metadata: Metadata = {
  title: { absolute: ADMIN_AREA.title },
  robots: { index: false, follow: false },
};

export default function AdminOverviewPage() {
  return (
    <Section aria-labelledby="admin-heading">
      <Container>
        <SectionHeader
          as="h1"
          titleId="admin-heading"
          title={ADMIN_AREA.heading}
          description={ADMIN_AREA.description}
        />

        <div className="mt-8 flex flex-col gap-6">
          <Card>
            <CardContent>
              <span
                aria-hidden="true"
                className="text-primary bg-accent mb-4 flex size-11 items-center justify-center rounded-full"
              >
                <Users className="size-5" />
              </span>
              <h2 className="text-h5 font-sans">{ADMIN_USERS_PAGE.heading}</h2>
              <p className="text-body-sm text-muted-foreground measure mt-2">
                {ADMIN_USERS_PAGE.description}
              </p>
              <Button asChild className="mt-5">
                <Link href="/admin/users">{ADMIN_USERS_PAGE.title}</Link>
              </Button>
            </CardContent>
          </Card>

          <Alert tone="info" title={ADMIN_AREA.scopeNoticeTitle}>
            {ADMIN_AREA.scopeNoticeBody}
          </Alert>
        </div>
      </Container>
    </Section>
  );
}
