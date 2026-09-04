"use client";

import { Select } from "@selecta/ui/components/select";
import { Button } from "@selecta/ui/components/button";

import type { SequenceVersion } from "@/lib/sequences/types";
import { BASE_VERSION_VALUE } from "@/lib/sequences/versions";

export function VersionSwitcher({
  versions,
  activeVersionId,
  canSave,
  onChange,
  onSave,
  onEdit,
  onDelete,
}: {
  versions: SequenceVersion[];
  activeVersionId: string | null;
  canSave: boolean;
  onChange: (versionId: string | null) => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const active = versions.find((item) => item.id === activeVersionId) ?? null;
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Version"
        title="Version"
        className="w-auto min-w-36"
        value={activeVersionId ?? BASE_VERSION_VALUE}
        onChange={(event) => {
          const value = event.target.value;
          onChange(value === BASE_VERSION_VALUE ? null : value);
        }}
      >
        <option value={BASE_VERSION_VALUE}>Base</option>
        {versions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      {active ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </>
      ) : canSave ? (
        <Button type="button" variant="outline" size="sm" onClick={onSave}>
          Save version
        </Button>
      ) : null}
    </div>
  );
}
