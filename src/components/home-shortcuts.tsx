"use client";

import Link from "next/link";

export function HomeShortcuts({
  items,
}: {
  items: { href: string; title: string; description: string }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
      {items.map((item) => (
        <Link
          className="bg-background px-4 py-5 transition-colors hover:bg-muted/60"
          href={item.href}
          key={item.href}
        >
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
