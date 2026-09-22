import { CalendarDays, Info, Leaf, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  CardListLoading,
  PageLoading,
} from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Reveal } from "@/components/shared/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardLink,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import {
  FOOTER_NAV_GROUPS,
  LEGAL_NAV_ITEMS,
  PRIMARY_CTA,
  PUBLIC_NAV_ITEMS,
} from "@/config/navigation";

import { InteractiveGallery } from "./interactive-gallery";

/**
 * The design-system review page.
 *
 * Not part of the product. It exists so the foundation can actually be looked
 * at, tabbed through and resized during this phase and every phase after it,
 * instead of being reviewed by reading source.
 *
 * In production it serves the not-found page instead, and none of the content
 * below is rendered. `NODE_ENV` is already "production" during `next build`,
 * so the route is *prerendered* as the not-found body: a production instance
 * cannot render this page at all, whatever the runtime environment says.
 *
 * The response status is 200 rather than 404. That is documented Next.js
 * behaviour - `notFound()` yields 200 for a streamed response and 404 for a
 * non-streamed one - and Next injects `<meta name="robots" content="noindex">`
 * on top of the `noindex` declared here. So the page is not indexed and leaks
 * nothing; it is a soft 404. Forcing a hard 404 would mean a rewrite in
 * `next.config.ts`, which is not worth complicating a security-focused file
 * for an internal review page.
 *
 * Everything here is composed from the shared primitives. If something on this
 * page needed a one-off style, the primitive was wrong.
 */
export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <>
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />

      <main id="main-content" className="flex-1">
        <Container width="wide" className="section-y flex flex-col gap-4">
          <p className="text-caption text-eyebrow font-medium tracking-[0.12em] uppercase">
            Internal
          </p>
          <h1 className="text-display text-heading font-normal">
            Punarvasu design system
          </h1>
          <p className="text-body-lg text-muted-foreground measure">
            The reusable visual and interaction foundation. Every page in the
            product is composed from these primitives and these tokens.
          </p>
          <Alert tone="info" title="Not a product page">
            This route is served only outside production and is never indexed.
          </Alert>
        </Container>

        <Separator />

        <ColorSection />
        <Separator />
        <TypographySection />
        <Separator />
        <ButtonSection />
        <Separator />
        <CardSection />
        <Separator />
        <BadgeSection />
        <Separator />

        {/* Dialogs, sheets, tabs, accordion, tooltip, select, form and toast -
            the parts that need client-side behaviour. */}
        <InteractiveGallery />

        <Separator />
        <StateSection />
        <Separator />
        <TableSection />
        <Separator />
        <MotionSection />
      </main>

      <SiteFooter
        groups={FOOTER_NAV_GROUPS}
        legalItems={LEGAL_NAV_ITEMS}
        tagline="Ayurvedic consultation and treatment, guided by qualified practitioners."
        disclaimer="Information on this website is general in nature and is not a substitute for professional diagnosis, treatment or emergency medical care. Ayurvedic approaches are personalised; please consult a qualified practitioner about your own circumstances."
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Gallery({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby={id}>
      <Container width="wide" className="flex flex-col gap-8">
        <SectionHeader
          titleId={id}
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
        {children}
      </Container>
    </Section>
  );
}

function Swatch({
  name,
  className,
  note,
}: {
  readonly name: string;
  readonly className: string;
  readonly note: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`border-border h-16 rounded-md border ${className}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-label text-foreground font-medium">{name}</p>
        <p className="text-caption text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function ColorSection() {
  return (
    <Gallery
      id="ds-color"
      eyebrow="Tokens"
      title="Colour"
      description="Semantic tokens only. Components never name a green; they name a role. Warm cream, sand and white are the three page surfaces; deep green inverts a band. Every foreground/background pair is asserted against WCAG AA in the test suite."
    >
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        <Swatch
          name="background"
          className="bg-background"
          note="Page surface"
        />
        <Swatch name="card" className="bg-card" note="Raised surface" />
        <Swatch name="muted" className="bg-muted" note="Quiet grouping" />
        <Swatch
          name="secondary"
          className="bg-secondary"
          note="Warm, paper-like"
        />
        <Swatch name="accent" className="bg-accent" note="Hover and selected" />
        <Swatch name="primary" className="bg-primary" note="Primary action" />
        <Swatch name="success" className="bg-success" note="Confirmed" />
        <Swatch name="warning" className="bg-warning" note="Needs attention" />
        <Swatch
          name="destructive"
          className="bg-destructive"
          note="Irreversible"
        />
        <Swatch name="info" className="bg-info" note="Neutral notice" />
        <Swatch
          name="brand-surface"
          className="bg-brand-surface"
          note="Inverted band"
        />
        <Swatch
          name="scrim"
          className="bg-scrim"
          note="Wash under text on photography"
        />
        <Swatch name="gold" className="bg-gold" note="Small accents only" />
        <Swatch
          name="terracotta"
          className="bg-terracotta"
          note="Editorial accent"
        />
        <Swatch name="border" className="bg-border" note="Divider" />
        <Swatch name="heading" className="bg-heading" note="Any heading" />
        <Swatch name="prose" className="bg-prose" note="Editorial body copy" />
        <Swatch
          name="eyebrow"
          className="bg-eyebrow"
          note="The label above a heading"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Alert tone="success" title="Appointment confirmed">
          Tuesday 24 September, 10:30 AM.
        </Alert>
        <Alert tone="warning" title="Payment pending">
          Complete payment to hold this slot.
        </Alert>
        <Alert tone="danger" title="We couldn't save your changes">
          Please check your connection and try again.
        </Alert>
        <Alert tone="info" title="Clinic hours">
          Consultations run Monday to Saturday.
        </Alert>
      </div>
    </Gallery>
  );
}

function TypographySection() {
  return (
    <Gallery
      id="ds-type"
      eyebrow="Tokens"
      title="Typography"
      description="Playfair Display for headings and brand voice, Inter for every functional surface. The scale is fluid: each step interpolates between its mobile and desktop size, so nothing is a shrunken desktop heading."
    >
      <div className="flex flex-col gap-5">
        <TypeRow token="text-display-xl" note="42 → 64px" serif>
          Ancient wisdom, modern care
        </TypeRow>
        <TypeRow token="text-h1" note="34 → 48px" serif>
          Panchakarma at Punarvasu
        </TypeRow>
        <TypeRow token="text-h2" note="30 → 40px" serif>
          Consultations and treatments
        </TypeRow>
        <TypeRow token="text-h3" note="26 → 32px" serif>
          What to expect on your first visit
        </TypeRow>
        <TypeRow token="text-h4" note="22 → 24px" serif>
          Preparing for treatment
        </TypeRow>
        <TypeRow token="text-body-lg" note="17 → 18px">
          Supporting copy that introduces a section without competing with the
          heading above it.
        </TypeRow>
        <TypeRow token="text-body" note="16px">
          Body text. Healthcare information must stay easy to read at a
          comfortable measure and a generous line height.
        </TypeRow>
        <TypeRow token="text-body-sm" note="14px">
          Descriptions, helper text and table content.
        </TypeRow>
        <TypeRow token="text-caption" note="12px">
          Captions, metadata and legal text.
        </TypeRow>
      </div>
    </Gallery>
  );
}

function TypeRow({
  token,
  note,
  serif = false,
  children,
}: {
  readonly token: string;
  readonly note: string;
  readonly serif?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-col gap-1 border-b pb-5 last:border-b-0">
      <p className="text-caption text-muted-foreground font-mono">
        {token} · {note}
      </p>
      <p
        className={`${token} ${serif ? "font-serif" : "font-sans"} text-foreground`}
      >
        {children}
      </p>
    </div>
  );
}

function ButtonSection() {
  return (
    <Gallery
      id="ds-buttons"
      eyebrow="Components"
      title="Buttons"
      description="Labels say what will happen. Every size clears a 44px touch target. Tab through these: the focus ring is the same everywhere."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button>Book a Consultation</Button>
        <Button variant="secondary">View Treatments</Button>
        <Button variant="outline">Save Changes</Button>
        <Button variant="ghost">View Appointment</Button>
        <Button variant="link">View all treatments</Button>
        <Button variant="destructive">Cancel Appointment</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Call the clinic" variant="outline">
          <Phone />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled>Disabled</Button>
        <Button loading loadingLabel="Booking...">
          Book a Consultation
        </Button>
        <Button variant="outline" loading loadingLabel="Saving...">
          Save Changes
        </Button>
        <Button asChild variant="outline">
          <Link href="/design-system">A link styled as a button</Link>
        </Button>
      </div>

      <div className="max-w-sm">
        <Button block size="lg">
          Full width on mobile
        </Button>
      </div>
    </Gallery>
  );
}

function CardSection() {
  return (
    <Gallery
      id="ds-cards"
      eyebrow="Components"
      title="Cards"
      description="Most cards use a border and a surface change. Shadow is reserved for genuinely elevated content. The interactive card puts a real link in the title and stretches its hit area — tab to it and the ring surrounds the whole card."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Default</CardTitle>
            <CardDescription>Border and surface. No shadow.</CardDescription>
          </CardHeader>
          <CardContent className="text-body-sm text-muted-foreground">
            The workhorse. Groups related information without shouting.
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardHeader>
            <CardTitle>
              <CardLink asChild>
                <Link href="/design-system">Interactive</Link>
              </CardLink>
            </CardTitle>
            <CardDescription>The whole card leads somewhere.</CardDescription>
          </CardHeader>
          <CardContent className="text-body-sm text-muted-foreground">
            One focusable element, a real accessible name, and a working
            middle-click.
          </CardContent>
        </Card>

        <Card variant="highlighted">
          <CardHeader>
            <CardTitle>Highlighted</CardTitle>
            <CardDescription>
              Recommended or selected. One per group.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-body-sm text-muted-foreground">
            Carries the herbal accent tint.
          </CardContent>
          <CardFooter>
            <StatusBadge status="confirmed" />
          </CardFooter>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Elevated</CardTitle>
            <CardDescription>Shadow earned, used sparingly.</CardDescription>
          </CardHeader>
        </Card>

        <Card variant="muted" padding="compact">
          <CardHeader>
            <CardTitle as="h3">Compact &amp; muted</CardTitle>
            <CardDescription>Dense lists and side panels.</CardDescription>
          </CardHeader>
        </Card>

        <Card padding="compact">
          <p className="text-caption text-muted-foreground">Upcoming</p>
          <p className="text-h3 text-foreground font-serif">3</p>
          <p className="text-body-sm text-muted-foreground">
            appointments this week
          </p>
        </Card>
      </div>
    </Gallery>
  );
}

function BadgeSection() {
  return (
    <Gallery
      id="ds-badges"
      eyebrow="Components"
      title="Badges"
      description="Every status carries an icon as well as a colour, so it survives a colour-blind reader and a black-and-white printout."
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status="confirmed" />
        <StatusBadge status="pending" />
        <StatusBadge status="scheduled" />
        <StatusBadge status="rescheduled" />
        <StatusBadge status="completed" />
        <StatusBadge status="cancelled" />
        <StatusBadge status="missed" />
        <StatusBadge status="draft" />
        <Badge tone="primary" icon={<Leaf />}>
          Seasonal
        </Badge>
        <Badge tone="neutral">Neutral</Badge>
      </div>
    </Gallery>
  );
}

function StateSection() {
  return (
    <Gallery
      id="ds-states"
      eyebrow="Patterns"
      title="Loading, empty and error"
      description="Never a blank screen, and never a raw server error. Skeletons match the shape of what is coming; empty states say what to do next; error states explain and offer a way back."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-label text-muted-foreground font-medium">
            Section loading — skeletons in the shape of the content
          </p>
          <CardListLoading label="Loading treatments" count={2} />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-label text-muted-foreground font-medium">
            Page loading — only where the shape is unknown
          </p>
          <div className="border-border rounded-lg border">
            <PageLoading label="Loading your appointments" className="py-12" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-label text-muted-foreground font-medium">
            Empty state
          </p>
          <EmptyState
            icon={<CalendarDays />}
            title="No upcoming appointments"
            description="You don't have an appointment scheduled yet."
            action={
              <Button asChild>
                <Link href="/design-system">Book a Consultation</Link>
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" asChild>
                <Link href="/design-system">Contact the clinic</Link>
              </Button>
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-label text-muted-foreground font-medium">
            Error state
          </p>
          <ErrorState
            description="We couldn't load your appointments."
            action={<Button variant="outline">Try Again</Button>}
            reference="a1b2c3d4"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-label text-muted-foreground font-medium">
          Skeleton parts
        </p>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <SkeletonText lines={3} className="max-w-md" />
          <div className="flex items-center gap-3">
            <Spinner label="Working" className="text-primary size-5" />
            <span className="text-body-sm text-muted-foreground">
              Spinner with an announced label
            </span>
          </div>
        </div>
      </div>
    </Gallery>
  );
}

function TableSection() {
  return (
    <Gallery
      id="ds-table"
      eyebrow="Components"
      title="Table"
      description="A foundation, not a data grid. The scroller is focusable and labelled, so an overflowing table is reachable by keyboard instead of unreachable."
    >
      <TableScroller label="Recent appointments">
        <Table>
          <TableCaption className="sr-only">
            Recent appointments, with practitioner, date and status
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Practitioner</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { ref: "PNV-10241", date: "24 September", status: "confirmed" },
              { ref: "PNV-10238", date: "12 September", status: "completed" },
              { ref: "PNV-10230", date: "28 August", status: "cancelled" },
            ].map((row) => (
              <TableRow key={row.ref}>
                <TableCell className="font-mono">{row.ref}</TableCell>
                <TableCell className="text-muted-foreground">
                  Not assigned
                </TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status as "confirmed"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroller>

      <Alert tone="info" title="Responsive strategy">
        Below <code className="font-mono">md</code>, a table a patient reads on
        a phone should become a card list rather than a horizontally squeezed
        grid. The scroller is for dense staff-facing tables.
      </Alert>
    </Gallery>
  );
}

function MotionSection() {
  return (
    <Gallery
      id="ds-motion"
      eyebrow="Tokens"
      title="Motion"
      description="Four categories and nothing outside them: micro feedback at 150ms, surfaces at 240ms, entrance at 420ms. Everything rises from the same direction, once. Turn on 'reduce motion' in your system settings and this page stops moving without losing anything."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {["Micro interaction", "Content entrance", "Surface"].map(
          (label, index) => (
            <Reveal key={label} delay={index * 80}>
              <Card>
                <CardHeader>
                  <CardTitle as="h3">{label}</CardTitle>
                  <CardDescription>
                    {index === 0
                      ? "Hover, focus, press. 150ms."
                      : index === 1
                        ? "A section arriving. 420ms, once."
                        : "Dialogs and sheets. 240ms."}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          ),
        )}
      </div>

      <div className="flex items-center gap-3">
        <Logo />
        <p className="text-body-sm text-muted-foreground">
          Brand treatment — a placeholder wordmark and mark, built to be
          replaced without touching a caller.
        </p>
      </div>

      <p className="text-body-sm text-muted-foreground flex items-center gap-2">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        Resize this page to 320px. Nothing should overflow horizontally.
      </p>
    </Gallery>
  );
}
