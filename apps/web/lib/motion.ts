/** Soft navigation helpers that respect prefers-reduced-motion. */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function navigateWithMotion(router: { push: (href: string) => void }, href: string) {
  if (
    prefersReducedMotion() ||
    typeof document === "undefined" ||
    !("startViewTransition" in document)
  ) {
    router.push(href);
    return;
  }

  (
    document as Document & {
      startViewTransition: (callback: () => void) => void;
    }
  ).startViewTransition(() => {
    router.push(href);
  });
}

export function motionDelay(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}
