import { redirect } from "next/navigation";

/** Legacy route — redirected to unified Add Transition mode (DJ-74). */
export default function LegacyNewNotePage() {
  redirect("/add?mode=transition");
}
