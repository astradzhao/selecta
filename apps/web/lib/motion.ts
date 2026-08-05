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

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

type Box = { left: number; top: number; width: number; height: number };

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
 * Keyframes that move an element sized at `to` so it *starts* looking like `from`.
 *
 * Laying the element out at its destination and scaling down means the browser
 * rasterizes at final size (no blur on the way up) and only transform/opacity
 * animate, which stays on the compositor. Radii are pre-divided by the scale so
 * the corners read correctly while stretched.
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

export type MorphCardOptions = {
  /** Row element the morph grows out of. */
  sourceCard: HTMLElement;
  /** Panel the row expands into. */
  targetPanel: HTMLElement;
  /** Thumbnail inside the row, morphed into `targetArt`'s slot. */
  sourceArt?: HTMLElement | null;
  /** Hero artwork slot; its geometry is the thumbnail's destination. */
  targetArt?: HTMLElement | null;
  /** Row text, carried a short distance and released rather than stretched. */
  sourceText?: HTMLElement | null;
  /** Hero text block; a ghost of it fades in at the destination mid-flight. */
  targetText?: HTMLElement | null;
  /** Rewrites the ghost with the incoming copy before it fades in. */
  prepareTargetText?: (ghost: HTMLElement) => void;
  duration?: number;
  /**
   * Runs once the morph covers the panel, while the overlay is still opaque.
   * Swap state here so the real panel renders underneath and the overlay can
   * be dropped without any crossfade.
   */
  onCover?: () => void | Promise<void>;
};

/**
 * Expand a list row into a panel: the row's shell grows into the panel rect
 * while its thumbnail scales into the hero artwork slot. Geometry is read
 * before the caller mutates state, so measure-then-animate stays accurate.
 */
export async function morphCardIntoPanel(options: MorphCardOptions): Promise<void> {
  const {
    sourceCard,
    targetPanel,
    sourceArt,
    targetArt,
    sourceText,
    targetText,
    prepareTargetText,
    duration = 440,
    onCover,
  } = options;

  const canAnimate =
    typeof document !== "undefined" &&
    typeof sourceCard.animate === "function" &&
    !prefersReducedMotion();
  if (!canAnimate) {
    await onCover?.();
    return;
  }

  const from = sourceCard.getBoundingClientRect();
  const to = targetPanel.getBoundingClientRect();
  if (!from.width || !to.width) {
    await onCover?.();
    return;
  }

  const easing = "cubic-bezier(0.2, 0, 0, 1)";
  const timing: KeyframeAnimationOptions = { duration, easing, fill: "forwards" };
  const animations: Animation[] = [];

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "60",
    pointerEvents: "none",
    contain: "strict",
  } satisfies Partial<CSSStyleDeclaration>);

  // Borderless slab: a 1px border would visibly thicken under non-uniform scale.
  const shell = document.createElement("div");
  placeAt(shell, to);
  Object.assign(shell.style, {
    background: window.getComputedStyle(targetPanel).backgroundColor,
    willChange: "transform",
  } satisfies Partial<CSSStyleDeclaration>);
  layer.appendChild(shell);
  animations.push(shell.animate(flipFrames(from, to, 16, cornerRadius(targetPanel)), timing));

  if (sourceText) {
    const textFrom = sourceText.getBoundingClientRect();
    const ghost = cloneForOverlay(sourceText);
    placeAt(ghost, textFrom);
    ghost.style.willChange = "transform, opacity";
    layer.appendChild(ghost);
    animations.push(
      ghost.animate(
        [
          { opacity: 1, transform: "translate(0px, 0px)" },
          { opacity: 0, transform: "translate(-10px, -6px)" },
        ],
        { duration: Math.round(duration * 0.4), easing: "ease-out", fill: "forwards" },
      ),
    );
  }

  if (sourceArt && targetArt) {
    const artFrom = sourceArt.getBoundingClientRect();
    const artTo = targetArt.getBoundingClientRect();
    if (artFrom.width && artTo.width) {
      const artClone = cloneForOverlay(sourceArt);
      placeAt(artClone, artTo);
      Object.assign(artClone.style, {
        overflow: "hidden",
        willChange: "transform",
      } satisfies Partial<CSSStyleDeclaration>);
      layer.appendChild(artClone);
      animations.push(
        artClone.animate(
          flipFrames(artFrom, artTo, cornerRadius(sourceArt), cornerRadius(targetArt)),
          timing,
        ),
      );
    }
  }

  // Incoming copy rides the tail of the morph so the panel is never a blank
  // slab waiting on the state swap.
  if (targetText) {
    const ghost = cloneForOverlay(targetText);
    prepareTargetText?.(ghost);
    placeAt(ghost, targetText.getBoundingClientRect());
    Object.assign(ghost.style, {
      height: "auto",
      willChange: "transform, opacity",
    } satisfies Partial<CSSStyleDeclaration>);
    layer.appendChild(ghost);
    animations.push(
      ghost.animate(
        [
          { opacity: 0, transform: "translate(0px, 8px)" },
          { opacity: 1, transform: "translate(0px, 0px)" },
        ],
        {
          duration: Math.round(duration * 0.55),
          delay: Math.round(duration * 0.45),
          easing,
          fill: "both",
        },
      ),
    );
  }

  document.body.appendChild(layer);

  try {
    await Promise.all(animations.map((animation) => animation.finished));
    await onCover?.();
    // Hold opaque until the swapped panel has actually painted underneath.
    await nextFrame();
  } catch {
    // Interrupted (unmount, navigation) — still hand control back to the caller.
    await onCover?.();
  } finally {
    layer.remove();
  }
}
