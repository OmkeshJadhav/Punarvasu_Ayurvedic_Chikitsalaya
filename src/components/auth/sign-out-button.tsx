import { SubmitButton } from "@/components/auth/submit-button";
import { signOutAction } from "@/features/auth/actions";
import { AUTH_PAGES } from "@/features/auth/content";
import type { ButtonProps } from "@/components/ui/button";

/**
 * Sign out.
 *
 * A form posting to a server action, not a link. Signing out changes state,
 * and a `GET` that changes state can be triggered by an image tag on another
 * site - which is how a "sign the user out" cross-site request works. As a
 * server action it also gets Next.js's `Origin`/`Host` check for free
 * (`phase_06.md` section 56).
 *
 * The action redirects to the public home page and revokes the account's
 * refresh tokens, so nothing that survives in a cache or in browser history
 * can be turned back into access (`phase_06.md` section 73).
 *
 * A server component: only the submit button needs the client, and it gets
 * there through `useFormStatus`.
 */
export function SignOutButton({
  variant = "outline",
  size = "sm",
  block,
}: {
  readonly variant?: ButtonProps["variant"];
  readonly size?: Exclude<ButtonProps["size"], "icon">;
  readonly block?: boolean;
}) {
  return (
    <form action={signOutAction}>
      <SubmitButton
        variant={variant}
        size={size}
        block={block}
        loadingLabel={AUTH_PAGES.account.signingOutLabel}
      >
        {AUTH_PAGES.account.signOutLabel}
      </SubmitButton>
    </form>
  );
}
