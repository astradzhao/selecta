/** Motion helpers that respect prefers-reduced-motion. */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function motionDelay(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

export function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Fly a clone of `source` into `target`'s slot (FLIP-style) so a list item
 * visually becomes the hero element instead of the two swapping abruptly.
 */
export async function flyElementInto(
  source: HTMLElement,
  target: HTMLElement,
  duration = 460,
): Promise<void> {
  if (prefersReducedMotion() || typeof document === "undefined") return;
  if (typeof source.animate !== "function") return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const clone = source.cloneNode(true) as HTMLElement;
  const scale = Math.min(1, to.width / from.width);
  const dx = to.left - from.left + (to.width - from.width * scale) / 2;
  const dy = to.top - from.top + 24;

  Object.assign(clone.style, {
    position: "fixed",
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
    transformOrigin: "top left",
    borderRadius: "1rem",
    overflow: "hidden",
  } satisfies Partial<CSSStyleDeclaration>);
  clone.setAttribute("aria-hidden", "true");
  document.body.appendChild(clone);

  try {
    await clone.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    ).finished;
  } catch {
    // Animation interrupted (navigation, unmount) — the clone still gets removed.
  } finally {
    clone.remove();
  }
}
