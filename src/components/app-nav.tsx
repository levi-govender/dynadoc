"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import {
  canEditDraft,
  canGenerateInstance,
  canManageOrganization,
  formatRole,
} from "@/lib/auth/roles";
import type { MembershipRole } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

function navClass(active: boolean) {
  return active
    ? "relative px-2 py-1.5 text-sm font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-primary"
    : "px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
}

export function AppNav({
  role,
  email,
  organizationName,
}: {
  role?: MembershipRole;
  email?: string;
  organizationName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const links: {
    href: string;
    label: string;
    match: (path: string) => boolean;
  }[] = [];
  if (role && canEditDraft(role)) {
    links.push({
      href: "/studio",
      label: "Studio",
      match: (path) => path.startsWith("/studio"),
    });
  }
  if (role && canGenerateInstance(role)) {
    links.push({
      href: "/fill",
      label: "Fill",
      match: (path) => path.startsWith("/fill"),
    });
    links.push({
      href: "/history",
      label: "History",
      match: (path) => path.startsWith("/history"),
    });
  }
  if (role && canEditDraft(role)) {
    links.push({
      href: "/ingest",
      label: "Ingest",
      match: (path) => path.startsWith("/ingest"),
    });
  }
  if (role) {
    links.push({
      href: "/inbox",
      label: "Inbox",
      match: (path) => path.startsWith("/inbox"),
    });
  }
  if (role && canManageOrganization(role)) {
    links.push({
      href: "/org",
      label: "Organization",
      match: (path) => path.startsWith("/org"),
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background">
      <div className="mx-auto flex h-12 w-full max-w-[90rem] items-center gap-6 px-4 sm:px-6">
        <Link
          className="flex shrink-0 items-center gap-2 text-sm font-medium tracking-tight"
          href="/"
        >
          <FileText className="size-4 text-primary" strokeWidth={1.75} />
          Dynadoc
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {links.map((link) => (
            <Link
              className={navClass(link.match(pathname))}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {email ? (
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <p className="font-medium text-foreground">{email}</p>
              <p className="text-muted-foreground">
                {organizationName ? `${organizationName} · ` : ""}
                {role ? formatRole(role) : null}
              </p>
            </div>
            <Button
              disabled={pending}
              onClick={() => {
                setPending(true);
                void authClient.signOut().then(() => {
                  setPending(false);
                  router.push("/");
                  router.refresh();
                });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function AppChrome({
  role,
  email,
  organizationName,
  children,
  wide = false,
  flush = false,
}: {
  role?: MembershipRole;
  email?: string;
  organizationName?: string;
  children: ReactNode;
  wide?: boolean;
  flush?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppNav email={email} organizationName={organizationName} role={role} />
      <div
        className={
          flush
            ? "flex min-h-0 flex-1 flex-col"
            : wide
              ? "mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-6 px-4 py-8 sm:px-6"
              : "mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6"
        }
      >
        {children}
      </div>
    </div>
  );
}
