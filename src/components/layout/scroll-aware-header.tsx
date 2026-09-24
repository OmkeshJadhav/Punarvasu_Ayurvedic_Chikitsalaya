"use client";

import { useEffect, useState, type ComponentProps } from "react";

/**
 * The `<header>` element, told whether the page has scrolled.
 *
 * At the top of a page the bar is translucent and borderless, so it reads as
 * part of the opening composition rather than as a strip of chrome above it.
 * Once content scrolls beneath it, it turns solid and gains a hairline and a
 * soft shadow, because text sliding under a see-through bar is noise.
 *
 * This component only reports the state, as `data-scrolled`; every visual
 * difference is a `data-[scrolled]:` class in `SiteHeader`. That keeps the
 * header's markup and styling in the server component and makes this the
 * smallest client boundary the effect allows.
 *
 * The state is a boolean past a small threshold, so a scroll event that does
 * not cross it re-renders nothing. The listener is passive and the initial
 * read happens in the effect, so a page restored mid-scroll starts solid.
 * Server-rendered HTML is the at-top state: correct for every fresh load.
 */
const SCROLL_THRESHOLD_PX = 8;

export function ScrollAwareHeader(props: ComponentProps<"header">) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > SCROLL_THRESHOLD_PX);

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <header data-scrolled={scrolled ? "" : undefined} {...props} />;
}
