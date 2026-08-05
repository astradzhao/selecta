/** Motion helpers that respect prefers-reduced-motion. */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function motionDelay(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/** Shared hop timeline — copy exit, art flight, and copy enter all use these. */
export const HOP_COPY_OUT_MS = 420;
export const HOP_FLIGHT_MS = 420;
export const HOP_COPY_IN_MS = 420;

export function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

type Box = { left: number; top: number; width: number; height: number };

function toBox(rect: DOMRectReadOnly): Box {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function placeAt(element: HTMLElement, box: Box): void {
  Object.assign(element.style, {
    position: "absolute",
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: "0",
    maxWidth: "none",
    transformOrigin: "top left",
  } satisfies Partial<CSSStyleDeclaration>);
}

function cornerRadius(element: Element): number {
  return parseFloat(window.getComputedStyle(element).borderTopLeftRadius) || 0;
}

/** Clones sit alongside the live DOM, so their ids would be duplicates. */
function cloneForOverlay(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  for (const node of clone.querySelectorAll("[id]")) node.removeAttribute("id");
  return clone;
}

/**
 * Keyframes that move an element laid out at `to` so it *starts* looking like `from`.
 *
 * Sizing at the destination and scaling down keeps the animation on the
 * compositor and rasterizes at final size, so scaling up never blurs. Radii are
 * pre-divided by the scale so corners read correctly while stretched.
 */
function flipFrames(from: Box, to: Box, fromRadius: number, toRadius: number): Keyframe[] {
  const scaleX = from.width / to.width;
  const scaleY = from.height / to.height;
  return [
    {
      transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scaleX}, ${scaleY})`,
      borderRadius: `${fromRadius / scaleX}px / ${fromRadius / scaleY}px`,
    },
    {
      transform: "translate(0px, 0px) scale(1, 1)",
      borderRadius: `${toRadius}px / ${toRadius}px`,
    },
  ];
}

export type ArtFlight = {
  /**
   * Fly onto `target`'s current rect. Call *after* the destination has been
   * committed and painted so the landing geometry is the real final layout —
   * measuring a predicted destination is what causes end-of-animation snapping.
   */
  landOn(target: HTMLElement, duration?: number): Promise<void>;
  destroy(): void;
};

/**
 * Lift a copy of `source` into a fixed overlay so it survives the DOM being
 * swapped underneath it. The clone holds the source's position until `landOn`.
 */
export function beginArtFlight(source: HTMLElement | null | undefined): ArtFlight | null {
  if (!source || typeof document === "undefined") return null;
  if (typeof source.animate !== "function" || prefersReducedMotion()) return null;

  const from = toBox(source.getBoundingClientRect());
  if (!from.width || !from.height) return null;
  const fromRadius = cornerRadius(source);

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "60",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const clone = cloneForOverlay(source);
  placeAt(clone, from);
  Object.assign(clone.style, {
    overflow: "hidden",
    borderRadius: `${fromRadius}px`,
    willChange: "transform",
  } satisfies Partial<CSSStyleDeclaration>);
  layer.appendChild(clone);
  document.body.appendChild(layer);

  let destroyed = false;

  return {
    async landOn(target, duration = HOP_FLIGHT_MS) {
      if (destroyed) return;
      const to = toBox(target.getBoundingClientRect());
      if (!to.width || !to.height) return;

      const frames = flipFrames(from, to, fromRadius, cornerRadius(target));
      // Re-anchor to the destination and pre-apply the "from" transform in the
      // same tick, so the clone never paints at the wrong place.
      placeAt(clone, to);
      clone.style.transform = String(frames[0].transform);
      clone.style.borderRadius = String(frames[0].borderRadius);

      try {
        await clone.animate(frames, {
          duration,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
          fill: "forwards",
        }).finished;
      } catch {
        // Interrupted — caller still reveals the real element.
      }
    },
    destroy() {
      destroyed = true;
      layer.remove();
    },
  };
}
