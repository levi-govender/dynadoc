import Link from "next/link";
import { canEditDraft, canGenerateInstance } from "@/lib/auth/roles";
import type { MembershipRole } from "@/lib/db/schema";

export function AppNav({ role }: { role?: MembershipRole }) {
  return (
    <nav className="flex gap-4 text-sm">
      <Link className="underline" href="/">
        Home
      </Link>
      {role && canEditDraft(role) ? (
        <Link className="underline" href="/studio">
          Author Studio
        </Link>
      ) : null}
      {role && canGenerateInstance(role) ? (
        <Link className="underline" href="/fill">
          Fill
        </Link>
      ) : null}
    </nav>
  );
}
