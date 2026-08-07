import { redirect } from "next/navigation";

/** Legacy route — redirected to unified Add (DJ-74). */
export default function LegacyAddTrackPage() {
  redirect("/add?mode=track");
}
