"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ProfileForm } from "@/components/patient/profile-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { savePatientProfileAction } from "@/features/patients/actions";
import { PROFILE_COPY } from "@/features/patients/content";
import {
  IDLE_PATIENT_FORM_STATE,
  type PatientFormState,
  type PatientProfile,
} from "@/features/patients/types";

/**
 * The editable part of the profile page.
 *
 * ## Why it is a client island rather than a client page
 *
 * The page around it — heading, completeness panel, account details, the
 * read-only summary — is server-rendered. Only the part that has to switch
 * between reading and editing, and hold a pending state while it saves, is a
 * client component (`docs/ARCHITECTURE.md`, UI boundaries).
 *
 * ## Create and edit are one operation
 *
 * `profile === null` means no record exists yet, and the component opens
 * straight into the form with onboarding copy — no empty state to click
 * through before the thing the patient came to do
 * (`phase_07.md` sections 6 and 65). Once a record exists it opens in view
 * mode. The server action behind both is the same one, because from the
 * patient's side there is one operation, and because deciding between insert
 * and update on the client would mean trusting the client about state it
 * cannot know.
 *
 * ## After a save
 *
 * The action revalidates the route, so the server re-renders and this
 * component receives the stored record as a fresh prop. The summary therefore
 * shows what the database holds, not what the form believed it sent — which is
 * the reason there are no optimistic updates here
 * (`phase_07.md` section 36). The confirmation is a toast, because by then the
 * form it would have sat above has gone.
 */
export function ProfileEditor({
  profile,
  email,
  summary,
}: {
  readonly profile: PatientProfile | null;
  readonly email: string | null;
  /**
   * The read-only view, rendered on the server and passed in as a child.
   *
   * A server component cannot be imported by a client component, but it can be
   * handed to one as a prop — so the summary stays server-rendered and this
   * component only decides whether to show it or the form.
   */
  readonly summary: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    savePatientProfileAction,
    IDLE_PATIENT_FORM_STATE,
  );

  const creating = profile === null;
  const [editing, setEditing] = useState(creating);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const { toast } = useToast();

  /*
    Reacting to a new action result *during render* rather than in an effect.
    This is the pattern React documents for adjusting state when a value a
    component already has changes, and the project's ESLint configuration
    rejects the effect version (`react-hooks/set-state-in-effect`) — correctly,
    because an effect would paint the form once more before collapsing it.

    Identity comparison, not a status check: `useActionState` returns a new
    object per submission, so two consecutive successful saves are two distinct
    results and both are handled.
  */
  const [handledState, setHandledState] = useState<PatientFormState>(
    IDLE_PATIENT_FORM_STATE,
  );

  if (state !== handledState) {
    setHandledState(state);

    if (state.status === "success") {
      setEditing(false);
      setConfirmingDiscard(false);
    }
  }

  /*
    The confirmation, in an effect rather than in the render above.

    `toast()` updates the `Toaster` that owns the toast region — a different
    component — and doing that during render is the "cannot update a component
    while rendering another" case. Adjusting this component's own state during
    render is fine; reaching into another one's is not, and an effect is where
    that belongs.

    The ref tracks which result has already been announced, so a re-render for
    an unrelated reason does not announce the same save twice.

    The wording comes from the action, which is the only party that knows
    whether the record was created or updated. Deriving it here from
    `profile === null` would be wrong precisely when it matters: by the time
    this runs after a first save, the route has revalidated and the profile is
    no longer null.
  */
  const announcedRef = useRef<PatientFormState>(IDLE_PATIENT_FORM_STATE);

  useEffect(() => {
    if (state.status !== "success" || announcedRef.current === state) return;

    announcedRef.current = state;
    toast({
      tone: "success",
      title: PROFILE_COPY.saveSuccessTitle,
      ...(state.message ? { description: state.message } : {}),
    });
  }, [state, toast]);

  const handleCancel = (dirty: boolean) => {
    // Only ask when there is something to lose. A confirmation on every Cancel
    // trains people to dismiss it, which is how the one that mattered gets
    // dismissed too.
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    setEditing(false);
  };

  if (!editing && profile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button type="button" onClick={() => setEditing(true)}>
            {PROFILE_COPY.editLabel}
          </Button>
        </div>
        {summary}
      </div>
    );
  }

  return (
    <>
      <ProfileForm
        formAction={formAction}
        profile={profile}
        email={email}
        fieldErrors={state.fieldErrors}
        submittedValues={state.values}
        pending={pending}
        submitLabel={
          creating ? PROFILE_COPY.createSubmitLabel : PROFILE_COPY.saveLabel
        }
        submittingLabel={
          creating
            ? PROFILE_COPY.createSubmittingLabel
            : PROFILE_COPY.savingLabel
        }
        {...(creating ? {} : { onCancel: handleCancel })}
        message={
          state.status === "error" && state.message ? (
            <Alert
              tone="danger"
              title={PROFILE_COPY.saveErrorTitle}
              className="mb-2"
            >
              {state.message}
            </Alert>
          ) : null
        }
      />

      <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <DialogContent>
          <DialogTitle>{PROFILE_COPY.unsavedChangesTitle}</DialogTitle>
          <DialogDescription>
            {PROFILE_COPY.unsavedChangesBody}
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmingDiscard(false)}
            >
              {PROFILE_COPY.unsavedChangesCancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmingDiscard(false);
                setEditing(false);
              }}
            >
              {PROFILE_COPY.unsavedChangesConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
