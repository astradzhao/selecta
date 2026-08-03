"use client";

import { XIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

export type TagItem = {
  name: string;
};

export function TagEditor({
  id,
  label,
  hint,
  placeholder,
  values,
  onChange,
  badgeVariant = "secondary",
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder: string;
  values: TagItem[];
  onChange: (next: TagItem[]) => void;
  badgeVariant?: "secondary" | "outline";
}) {
  function addTag(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (values.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...values, { name }]);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Input
        id={id}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTag(event.currentTarget.value);
            event.currentTarget.value = "";
          }
        }}
      />
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <Badge key={item.name} variant={badgeVariant} className="gap-1 pr-1">
              {item.name}
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
