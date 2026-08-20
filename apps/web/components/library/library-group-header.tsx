export function LibraryGroupHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="bg-surface-1 flex h-8 items-center gap-2 border-b px-3.5">
      <span className="text-eyebrow">{label}</span>
      {count != null ? (
        <span className="bg-warning-subtle text-warning text-numeric rounded-full px-1.5 text-xs font-medium">
          {count}
        </span>
      ) : null}
    </div>
  );
}
