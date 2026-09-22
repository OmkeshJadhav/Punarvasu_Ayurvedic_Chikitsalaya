"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FieldControlProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { suggestMedicinesAction } from "@/features/prescriptions/actions";
import { PRESCRIPTION_BUILDER_COPY } from "@/features/prescriptions/content";
import type { MedicineSuggestion } from "@/features/prescriptions/types";
import { cn } from "@/lib/utils/cn";

/**
 * The medicine or remedy name, with suggestions from this doctor's own
 * prescribing history (`phase_13.md` section 65).
 *
 * ## What it suggests, and what it does not
 *
 * It offers **names this practitioner has written before**, prefix-matched as
 * they type. It is not a catalog, it makes no clinical claim, it never
 * preselects anything, and it never fills a dose, a frequency or a duration.
 * The doctor can ignore it entirely and type anything — the field is an
 * ordinary text input with a list attached. Sections 5, 6 and 63: the system
 * must not choose a treatment, and remembering a spelling is not choosing a
 * treatment.
 *
 * Picking a suggestion copies the name and, if the field is still empty, the
 * form last used with it — a convenience the doctor can overwrite, offered
 * through `onPickForm` so this component never reaches into the row itself.
 *
 * ## Why the term never reaches a URL
 *
 * It is a server action, not a `GET` endpoint. What a doctor is typing into a
 * medicine field is clinical content, and a URL reaches browser history on a
 * shared consulting-room machine, proxy logs and the next `Referer`. The same
 * reasoning Phase 10 and Phase 11 applied to patient search, and the action
 * never logs the term either.
 *
 * ## Debouncing
 *
 * 220ms after the last keystroke. A request per keystroke would be a query
 * against prescription history per keystroke, and the doctor would see the
 * list flicker through three wrong answers on the way to the right one. Every
 * in-flight request carries a sequence number and a stale reply is discarded,
 * so a slow response cannot overwrite a newer one.
 *
 * ## Accessibility
 *
 * The WAI-ARIA combobox pattern, not a `<datalist>`: a datalist cannot say
 * "still loading", cannot be styled to the design system and is announced
 * inconsistently. So this is a real `role="combobox"` with
 * `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant`, a `role="listbox"` of `role="option"`s, arrow-key
 * navigation, Enter to accept, Escape to dismiss, and a polite live region
 * that says how many suggestions there are. The input keeps focus throughout.
 */
export function MedicineNameField({
  value,
  onChange,
  onPickForm,
  disabled = false,
  controlProps,
  className,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Called only when the row's form field is empty, so nothing is overwritten. */
  readonly onPickForm?: (form: string) => void;
  readonly disabled?: boolean;
  /** The props `Field` injects: id, name, aria-describedby and the rest. */
  readonly controlProps: FieldControlProps;
  readonly className?: string;
}) {
  const listboxId = useId();
  const statusId = useId();

  const [suggestions, setSuggestions] = useState<readonly MedicineSuggestion[]>(
    [],
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  /**
   * The term the field should *not* search for.
   *
   * Set when a suggestion is accepted, so that writing the name into the
   * input does not immediately reopen the list underneath the doctor's
   * cursor.
   */
  const suppressed = useRef<string | null>(null);
  const sequence = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Clearing the field is handled here rather than in the effect below.
   *
   * Every state update in this component therefore happens in an event
   * handler or in a timer callback, never synchronously in an effect body —
   * which is React's own rule, and the one ESLint's
   * `react-hooks/set-state-in-effect` enforces. Doing it in the effect would
   * also mean an extra render pass on every keystroke that empties the field.
   */
  function handleChange(next: string) {
    onChange(next);
    if (next.trim().length > 0) return;

    // Invalidate anything in flight, so a reply for the term that was just
    // deleted cannot reopen the list.
    sequence.current += 1;
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    setSearched(false);
    setActiveIndex(-1);
  }

  useEffect(() => {
    const term = value.trim();

    if (suppressed.current !== null && suppressed.current === value) return;
    suppressed.current = null;

    if (term.length === 0) return;

    const requestId = ++sequence.current;

    const timer = window.setTimeout(() => {
      setLoading(true);
      void suggestMedicinesAction(term)
        .then((results) => {
          // A reply for a term the doctor has already typed past is worse
          // than no reply: it would replace the right list with an old one.
          if (requestId !== sequence.current) return;
          setSuggestions(results);
          setActiveIndex(-1);
          setSearched(true);
          setOpen(true);
          setLoading(false);
        })
        .catch(() => {
          if (requestId !== sequence.current) return;
          // An autocomplete that cannot reach the server must never stop a
          // doctor typing a medicine name.
          setSuggestions([]);
          setSearched(true);
          setLoading(false);
        });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [value]);

  // A click anywhere else means the doctor has moved on.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function accept(suggestion: MedicineSuggestion) {
    suppressed.current = suggestion.medicineName;
    onChange(suggestion.medicineName);
    if (suggestion.form) onPickForm?.(suggestion.form);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = current + step;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      const suggestion = suggestions[activeIndex];
      if (suggestion) {
        // Only when a suggestion is highlighted, so Enter in a field the
        // doctor has simply typed into does not swallow their submit.
        event.preventDefault();
        accept(suggestion);
      }
      return;
    }

    if (event.key === "Tab" && open) setOpen(false);
  }

  // An empty field never shows a list, whatever state is left over — the same
  // guarantee the database makes about an empty search term.
  const expanded =
    open &&
    value.trim().length > 0 &&
    (loading || suggestions.length > 0 || searched);
  const activeOptionId =
    expanded && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        {...controlProps}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        {...(activeOptionId ? { "aria-activedescendant": activeOptionId } : {})}
        autoComplete="off"
        // Keep a browser's own saved-values dropdown and a password manager
        // out of a clinical field on a shared consulting-room machine.
        data-1p-ignore
        spellCheck={false}
        disabled={disabled}
        value={value}
        placeholder={PRESCRIPTION_BUILDER_COPY.medicinePlaceholder}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />

      {/*
        The count, for somebody who cannot see the list appear. Polite, so it
        waits for a pause rather than interrupting typing.
      */}
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {loading
          ? PRESCRIPTION_BUILDER_COPY.suggestionsLoading
          : expanded && suggestions.length > 0
            ? `${suggestions.length} ${
                suggestions.length === 1 ? "suggestion" : "suggestions"
              }`
            : ""}
      </p>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={PRESCRIPTION_BUILDER_COPY.suggestionsLabel}
        hidden={!expanded}
        className="border-border bg-popover absolute top-full right-0 left-0 z-(--z-popover) mt-1 max-h-60 overflow-y-auto rounded-md border py-1 shadow-md"
      >
        {loading && suggestions.length === 0 ? (
          <li className="text-body-sm text-muted-foreground px-3 py-2">
            {PRESCRIPTION_BUILDER_COPY.suggestionsLoading}
          </li>
        ) : suggestions.length === 0 ? (
          <li className="text-body-sm text-muted-foreground px-3 py-2">
            {PRESCRIPTION_BUILDER_COPY.suggestionsEmpty}
          </li>
        ) : (
          suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.medicineName}-${index}`}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "text-body-sm flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 font-sans",
                index === activeIndex
                  ? "bg-accent text-foreground"
                  : "text-foreground",
              )}
              // `mousedown` rather than `click`: the input loses focus first
              // on a click, which closes the list before the pick lands.
              onMouseDown={(event) => {
                event.preventDefault();
                accept(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {suggestion.medicineName}
              </span>
              {suggestion.form ? (
                <span className="text-caption text-muted-foreground shrink-0">
                  {suggestion.form}
                </span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
