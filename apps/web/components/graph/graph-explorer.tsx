"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { ConfirmDialog } from "@selecta/ui/components/confirm-dialog";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { NextTransitions } from "@/components/graph/next-transitions";
import { NowPlayingPanel } from "@/components/graph/now-playing-panel";
import { SaveTrailDialog } from "@/components/graph/save-trail-dialog";
import { useGraphExplorer } from "@/components/graph/use-graph-explorer";
import { AlternateLabelDialog } from "@/components/sequences/alternate-label-dialog";
import { GraphSetRail } from "@/components/sequences/graph-set-rail";
import { OffScriptDialog } from "@/components/sequences/off-script-dialog";
import { useGraphSetMode } from "@/components/sequences/use-graph-set-mode";

export function GraphExplorer({ onExit }: { onExit: () => void }) {
  const explorer = useGraphExplorer();
  const setMode = useGraphSetMode(explorer.neighbors);
  const { trackId, current, error, pending, choosingId, neighbors, trail } = explorer;
  const [saveOpen, setSaveOpen] = useState(false);

  if (!trackId) return null;

  if (pending && !current) {
    return (
      <StatePanel
        variant="loading"
        className="motion-safe:animate-in motion-safe:fade-in-0 duration-base"
      >
        Loading neighborhood…
      </StatePanel>
    );
  }

  if (error || !current) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 duration-slow space-y-4">
        <Alert variant="destructive">{error ?? "Track not found."}</Alert>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onExit}>
            Back to Graph
          </Button>
          <Button asChild variant="outline">
            <Link href={`/tracks/${trackId}`}>Track detail</Link>
          </Button>
        </div>
      </div>
    );
  }

  const swapping = choosingId !== null;

  return (
    <div className="space-y-4">
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 duration-slow flex flex-wrap items-center justify-between gap-3">
        {setMode.active ? (
          <GraphSetRail mode={setMode} />
        ) : (
          <p className="text-muted-foreground text-sm text-pretty">
            Expand a neighbor for mix detail, then choose it to traverse.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={trail.length < 1}
            onClick={() => setSaveOpen(true)}
          >
            Save as block
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)] lg:gap-6">
        <NowPlayingPanel
          current={current}
          copyPhase={explorer.copyPhase}
          artHidden={explorer.artHidden}
          swapping={swapping}
          canGoBack={explorer.trail.length > 0}
          outboundCount={neighbors.length}
          onBack={explorer.goBackInTrail}
          panelRef={explorer.panelRef}
        />
        <NextTransitions
          currentId={current.id}
          neighbors={neighbors}
          pins={setMode.pins}
          seamMarker={setMode.seamMarker}
          expandedKey={explorer.expandedKey}
          adding={explorer.adding}
          swapping={swapping}
          choosingId={choosingId}
          baseId={explorer.baseId}
          onExit={onExit}
          onToggleAdd={() => explorer.setAdding((value) => !value)}
          onCreated={async () => {
            explorer.setAdding(false);
            await explorer.refreshNeighborhood();
          }}
          registerRef={explorer.registerCardRef}
          onToggle={(rowKey, expanded) => {
            explorer.setExpandedKey(expanded ? null : rowKey);
            if (!expanded) void explorer.loadNeighborhood(rowKey).catch(() => null);
          }}
          onPrefetch={(neighborId) => void explorer.loadNeighborhood(neighborId).catch(() => null)}
          onChoose={(neighborId, transitionId) =>
            void explorer.goToTrack(
              neighborId,
              transitionId,
              explorer.cardElement(neighborId),
              setMode.handleHop,
            )
          }
          onNeighborhoodChange={explorer.refreshNeighborhood}
        />
      </div>
      {trackId ? (
        <SaveTrailDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          trail={trail}
          activeId={trackId}
        />
      ) : null}
      <OffScriptDialog
        prompt={setMode.alternateDraft || setMode.nestedConfirm ? null : setMode.offScript}
        error={setMode.offScriptError}
        pending={setMode.offScriptPending}
        canSaveAlternate={setMode.canSaveAlternate}
        onSaveAlternate={setMode.saveAlternate}
        onInsert={setMode.insertHere}
        onReplace={setMode.replacePlanned}
        onKeepExploring={setMode.keepExploring}
        onOpenChange={(open) => {
          if (!open) setMode.dismissOffScript();
        }}
      />
      <AlternateLabelDialog
        draft={setMode.alternateDraft}
        pending={setMode.offScriptPending}
        error={setMode.offScriptError}
        onOpenChange={(open) => {
          if (!open) setMode.cancelAlternate();
        }}
        onConfirm={(label) => void setMode.confirmAlternate(label)}
      />
      <ConfirmDialog
        open={setMode.nestedConfirm != null}
        onOpenChange={(open) => {
          if (!open) setMode.cancelNested();
        }}
        title={`Edit “${setMode.nestedConfirm?.title ?? "this block"}”?`}
        description={`This edits “${setMode.nestedConfirm?.title ?? "this block"}” everywhere it's used.`}
        confirmLabel="Edit block"
        variant="default"
        onConfirm={setMode.confirmNested}
      />
    </div>
  );
}
