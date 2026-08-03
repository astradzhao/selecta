import Link from "next/link";

import { Button } from "@selecta/ui/components/button";

import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell currentPath="/">
      <main className="flex flex-1 flex-col justify-center gap-8 py-16">
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">Selecta</p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Build the crate. Tag the feel. Mix from the graph.
          </h1>
          <p className="text-muted-foreground max-w-lg text-base text-pretty">
            Import tracks, keep musical labels and folders separate, then grow the transition graph
            from free-form notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/songs/new">Add song</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/library">Open library</Link>
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
