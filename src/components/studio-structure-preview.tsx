"use client";

import type { StudioResolve } from "@/lib/document-types/structure-preview";

export function StudioStructurePreview({
  resolved,
}: {
  resolved: StudioResolve;
}) {
  if (!resolved.ok) {
    return (
      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Structure preview</h2>
        <p className="text-sm text-destructive">{resolved.error}</p>
      </section>
    );
  }

  const { document, warnings } = resolved.result;

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-sm font-medium">Structure preview</h2>
      <p className="text-xs text-muted-foreground">
        Same resolver as generate. Not a PDF.
      </p>
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-amber-800">
          {warnings.map((warning, index) => (
            <li key={`${warning.field}-${warning.placeholder}-${index}`}>
              Missing {warning.field}: {warning.placeholder}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No resolver warnings.</p>
      )}
      <ol className="flex flex-col gap-2 text-sm">
        {document.blocks.map((block) => (
          <li className="rounded-md border px-2 py-1" key={block.id}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {block.type}
            </p>
            <p className="font-serif text-[13px] leading-6 text-zinc-800">
              {(block.rows ?? [])
                .map((row) => row.map((child) => child.text).join(""))
                .join(" · ") ||
                (block.children ?? []).map((child) => child.text).join("") ||
                "—"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
