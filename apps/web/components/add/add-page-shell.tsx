import { PageHeader } from "@selecta/ui/components/page-header";

import { BackLink } from "@/components/common/back-link";

export function AddPageShell({
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <PageHeader
        size="section"
        title={title}
        description={description}
        lead={<BackLink href={backHref}>{backLabel}</BackLink>}
      />
      <div className="border-border bg-surface-1 rounded-xl border px-5 py-6">{children}</div>
    </div>
  );
}
