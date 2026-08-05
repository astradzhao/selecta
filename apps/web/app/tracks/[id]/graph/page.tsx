import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Compat: old per-track graph URLs seed the single `/graph` session. */
export default async function TrackGraphRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/graph?track=${encodeURIComponent(id)}`);
}
