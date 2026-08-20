import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";

export function AddNewButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <PlusIcon />
        {label}
      </Link>
    </Button>
  );
}
