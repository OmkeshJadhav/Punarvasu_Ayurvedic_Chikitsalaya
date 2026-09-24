import { cn } from "@/lib/utils/cn";

/**
 * A heading with one phrase set in italic.
 *
 * The editorial device the home page uses in its display headings - "An
 * Ayurvedic clinic, practised *patiently*". It stays a device only while it is
 * rare: one phrase per heading, and never a whole line.
 *
 * The phrase is looked up in the text rather than passed as markup, so the
 * copy stays a plain string in `config/marketing-content.ts` where a clinician
 * reviews it. A phrase that is not found renders the text unchanged; a copy
 * edit can lose the emphasis, but it can never lose words.
 *
 * `<em>` rather than a styled `<span>`: the stress is part of the sentence's
 * meaning, and a screen reader that voices emphasis should voice it here.
 */
export interface EmphasisProps {
  readonly text: string;
  readonly phrase?: string;
  /** Colour for the emphasised phrase - the brand accent on a dark band. */
  readonly className?: string;
}

export function Emphasis({ text, phrase, className }: EmphasisProps) {
  const index = phrase ? text.indexOf(phrase) : -1;

  if (!phrase || index === -1) {
    return text;
  }

  return (
    <>
      {text.slice(0, index)}
      <em className={cn("font-serif italic", className)}>{phrase}</em>
      {text.slice(index + phrase.length)}
    </>
  );
}
