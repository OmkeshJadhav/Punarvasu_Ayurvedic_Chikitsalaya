"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AUTH_PAGES } from "@/features/auth/content";

/**
 * "Continue with Google".
 *
 * **Not yet connected to a provider.** The button is on the page so the
 * sign-in layout is final, but OAuth is a later change. Until then, pressing
 * it announces that Google sign-in is unavailable and points back to the
 * email form - a control that silently does nothing is worse than no control.
 *
 * When the provider is wired up, this becomes a form posting to a server
 * action that starts the OAuth flow; the `next` destination must go through
 * `safeRedirectPath` exactly as the email form's does.
 *
 * The status line is rendered - empty, and not `display: none` - from the
 * start, so screen readers register the live region before its text arrives;
 * that is what makes the message announced rather than silent.
 */
export function GoogleSignInButton({
  disabled = false,
}: {
  readonly disabled?: boolean;
}) {
  const [showNotice, setShowNotice] = useState(false);
  const copy = AUTH_PAGES.login;

  return (
    <div>
      <Button
        variant="outline"
        size="lg"
        block
        disabled={disabled}
        onClick={() => setShowNotice(true)}
        className="bg-card hover:bg-muted hover:text-foreground hover:border-border-strong"
      >
        <GoogleMark />
        {copy.googleLabel}
      </Button>
      <p
        role="status"
        className="text-body-sm text-muted-foreground motion-safe:animate-fade-in mt-3 text-center empty:mt-0"
      >
        {showNotice ? copy.googleUnavailable : null}
      </p>
    </div>
  );
}

/**
 * Google's "G" mark.
 *
 * Its four colours are Google's, not Punarvasu's, and are hard-coded on
 * purpose: Google's sign-in branding guidelines require the mark to be
 * reproduced unaltered, so it is the one place these pages step outside the
 * design tokens.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5!">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3A7.2 7.2 0 0 1 12 19.2a7.1 7.1 0 0 1-6.68-4.92H1.31v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.32 14.28A7.2 7.2 0 0 1 4.94 12c0-.79.14-1.56.38-2.28v-3.1H1.31a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.31 6.62l4.01 3.1A7.1 7.1 0 0 1 12 4.77Z"
      />
    </svg>
  );
}
