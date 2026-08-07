"use client";

import { XIcon } from "lucide-react";

import { FOLDER_KINDS, type FolderKind } from "@selecta/db/constants";
import { Badge } from "@selecta/ui/components/badge";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

export type FolderTag = {
  name: string;
  kind?: FolderKind;
};

export function FolderTagEditor({
  values,
  onChange,
}: {
  values: FolderTag[];
  onChange: (next: FolderTag[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor="folder-tag">Folders</Label>
        <p className="text-muted-foreground text-xs">
          Playlists, folders, and set buckets — separate from musical subgenres.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="folder-tag"
          className="flex-1"
          placeholder="Add folder, then Enter"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const name = event.currentTarget.value.trim();
            if (!name) return;
            if (values.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
            const kindSelect = document.getElementById("folder-kind") as HTMLSelectElement | null;
            const kind = (kindSelect?.value || undefined) as FolderKind | undefined;
            onChange([...values, { name, ...(kind ? { kind } : {}) }]);
            event.currentTarget.value = "";
          }}
        />
        <select
          id="folder-kind"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          defaultValue=""
          aria-label="Folder kind"
        >
          <option value="">Kind (optional)</option>
          {FOLDER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <Badge key={item.name} variant="outline" className="gap-1 pr-1">
              {item.name}
              {item.kind ? <span className="text-muted-foreground">· {item.kind}</span> : null}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(values.filter((v) => v.name !== item.name))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
