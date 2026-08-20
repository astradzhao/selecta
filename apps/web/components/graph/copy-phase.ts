/** Copy/meta opacity during a hop — opacity only, never translate/scale (those snap). */
export type CopyPhase = "visible" | "out" | "hidden" | "in";

/** Durations use --duration-hop so CSS and JS hop waits stay on one token. */
export const COPY_PHASE_CLASS: Record<CopyPhase, string> = {
  visible: "opacity-100",
  out: "opacity-0 ease-in duration-hop",
  hidden: "opacity-0 duration-0",
  in: "opacity-100 ease-out duration-hop",
};
