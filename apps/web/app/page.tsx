import Link from "next/link";

import { Button } from "@selecta/ui/components/button";

import { AppShell } from "@/components/app-shell";
import { libraryAddHref } from "@/lib/library/add-routes";

export default function Home() {
  return (
    <AppShell currentPath="/">
      <main className="flex flex-1 flex-col justify-center gap-8 py-16">
        <div className="space-y-3">
          {/* display one-off — not text-page-title */}
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">selecta</h1>
          <p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
            Build your personal DJ graph just by writing notes for yourself. We&apos;ll build the
            track selector for you.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={libraryAddHref("transitions")}>Add a transition</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/library">Open library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={libraryAddHref("tracks")}>Add a track</Link>
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
