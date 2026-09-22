"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, useToast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The parts of the design-system page that need client-side behaviour.
 *
 * Isolated into one client component so the review page itself, and the header
 * and footer it renders, stay server components. That is the pattern every
 * future page should follow: push `"use client"` down to the leaf that needs
 * it rather than up to the route.
 */
export function InteractiveGallery() {
  return (
    <Toaster>
      <TooltipProvider delayDuration={200}>
        <Section aria-labelledby="ds-overlays">
          <Container width="wide" className="flex flex-col gap-8">
            <SectionHeader
              titleId="ds-overlays"
              eyebrow="Components"
              title="Overlays, tabs and disclosure"
              description="Focus trapping, Escape, focus restoration and roving arrow-key focus all come from Radix. Open a dialog, press Escape, and check that focus returns to the trigger."
            />

            <div className="flex flex-wrap items-center gap-3">
              <ConfirmationDialogExample />
              <SheetExample />
              <TooltipExample />
              <ToastExamples />
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <TabsExample />
              <AccordionExample />
            </div>
          </Container>
        </Section>

        <FormExample />
      </TooltipProvider>
    </Toaster>
  );
}

function ConfirmationDialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open a confirmation dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            The slot is released immediately and cannot be reclaimed. You can
            book a new appointment at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep Appointment</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">Cancel Appointment</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SheetExample() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open a bottom sheet</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Appointment actions</SheetTitle>
          <SheetDescription>
            The drawer pattern: the same component as the side panel, docked to
            the bottom where a thumb can reach it.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button variant="outline" block>
            Reschedule
          </Button>
          <Button block>View Appointment</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TooltipExample() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="About Panchakarma">
          <Info />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Supplementary only — tab to this button and the tooltip opens on focus.
      </TooltipContent>
    </Tooltip>
  );
}

function ToastExamples() {
  const { toast } = useToast();

  return (
    <>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            tone: "success",
            title: "Appointment confirmed",
            description: "Tuesday 24 September, 10:30 AM.",
          })
        }
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            tone: "error",
            title: "We couldn't save your changes",
            description: "Please check your connection and try again.",
            action: { label: "Try again", onSelect: () => undefined },
          })
        }
      >
        Error toast (stays put)
      </Button>
    </>
  );
}

function TabsExample() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-muted-foreground font-medium">
        Tabs — related views of one subject
      </p>
      <Tabs defaultValue="overview">
        <TabsList aria-label="Patient record sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent
          value="overview"
          className="text-body-sm text-muted-foreground"
        >
          Use arrow keys to move between tabs. The selected tab carries weight
          and an underline, not only a colour.
        </TabsContent>
        <TabsContent
          value="appointments"
          className="text-body-sm text-muted-foreground"
        >
          Tabs switch between related content. A booking flow is a sequence of
          steps, not tabs.
        </TabsContent>
        <TabsContent
          value="documents"
          className="text-body-sm text-muted-foreground"
        >
          The list scrolls horizontally on a narrow screen rather than wrapping
          into a shifting second row.
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccordionExample() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-muted-foreground font-medium">
        Accordion — optional detail only
      </p>
      <Accordion type="single" collapsible>
        <AccordionItem value="first">
          <AccordionTrigger>How long is a first consultation?</AccordionTrigger>
          <AccordionContent>
            An initial consultation allows time for a full assessment. Exact
            duration depends on what the practitioner needs to discuss.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="second">
          <AccordionTrigger>Should I prepare anything?</AccordionTrigger>
          <AccordionContent>
            Bringing any recent reports or a list of current medication helps
            the practitioner form a complete picture.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * A form built from `Field`, including a deliberately invalid control so the
 * error styling, `aria-invalid` and `role="alert"` association can be checked
 * with a screen reader rather than assumed.
 */
function FormExample() {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  return (
    <Section aria-labelledby="ds-forms">
      <Container width="wide" className="flex flex-col gap-8">
        <SectionHeader
          titleId="ds-forms"
          eyebrow="Components"
          title="Forms"
          description="Every label is visible and bound to its control. Descriptions and errors are associated through aria-describedby, and the invalid state is announced, not just coloured."
        />

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            window.setTimeout(() => {
              setSubmitting(false);
              toast({ tone: "success", title: "Nothing was sent" });
            }, 900);
          }}
          className="grid max-w-2xl gap-5 sm:grid-cols-2"
        >
          <Field
            name="fullName"
            label="Full name"
            required
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                autoComplete="name"
                placeholder="Your full name"
                {...control}
              />
            )}
          </Field>

          <Field
            name="email"
            label="Email address"
            description="We'll use this email for appointment communication."
            required
          >
            {(control) => (
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...control}
              />
            )}
          </Field>

          <Field
            name="phone"
            label="Mobile number"
            error="Please enter a valid mobile number."
            required
          >
            {(control) => (
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="+91"
                {...control}
              />
            )}
          </Field>

          <Field name="treatment" label="Treatment of interest">
            {(control) => (
              <Select name={control.name}>
                <SelectTrigger
                  id={control.id}
                  aria-describedby={control["aria-describedby"]}
                >
                  <SelectValue placeholder="Choose a treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">
                    Initial consultation
                  </SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="panchakarma">Panchakarma</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field name="disabled" label="Disabled control" disabled>
            {(control) => <Input placeholder="Unavailable" {...control} />}
          </Field>

          <Field
            name="notes"
            label="Anything you'd like the practitioner to know"
            description="Optional. Please avoid sharing sensitive details here."
            className="sm:col-span-2"
          >
            {(control) => <Textarea placeholder="A short note" {...control} />}
          </Field>

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
            <Button
              type="submit"
              loading={submitting}
              loadingLabel="Booking..."
            >
              Book a Consultation
            </Button>
            <Button type="reset" variant="ghost">
              Clear form
            </Button>
          </div>
        </form>
      </Container>
    </Section>
  );
}
