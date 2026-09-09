"use client";

import {
  printPreviewLogoSrc,
  printPreviewPageCss,
} from "@/lib/document-types/print-preview";
import type { StudioResolve } from "@/lib/document-types/structure-preview";
import { resolveThemeSignatures } from "@/lib/document-types/signatures";
import type { DocumentTypeVersionSnapshot } from "@/types/document-type";

type Props = {
  snapshot: DocumentTypeVersionSnapshot;
  resolved: StudioResolve;
  draftWatermark?: boolean;
};

export function StudioPrintPreview({
  snapshot,
  resolved,
  draftWatermark = false,
}: Props) {
  const theme = snapshot.styleTheme;
  const css = printPreviewPageCss(theme);
  const logoSrc = printPreviewLogoSrc(theme);
  const signatures = resolveThemeSignatures(
    theme,
    resolved.ok ? resolved.result.answers : {},
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-200">
      <div className="border-b bg-background px-4 py-3">
        <h2 className="text-sm font-medium">Print preview</h2>
        <p className="text-xs text-muted-foreground">
          HTML stand-in for the issued PDF. Hyphenation, page breaks, and
          exact type metrics may differ in the downloaded file.
          {draftWatermark
            ? " Unpublished drafts show a DRAFT watermark."
            : null}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <article
          className="relative mx-auto overflow-hidden bg-white text-zinc-900 shadow-xl"
          style={{
            width: css.width,
            minHeight: css.minHeight,
            paddingTop: css.paddingTop,
            paddingRight: css.paddingRight,
            paddingBottom: css.paddingBottom,
            paddingLeft: css.paddingLeft,
            fontFamily: css.fontFamily,
            fontSize: css.fontSize,
          }}
        >
          {draftWatermark ? (
            <p
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold tracking-widest text-red-700/15"
              style={{ transform: "rotate(-28deg)" }}
            >
              DRAFT
            </p>
          ) : null}
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Logo"
              className="mb-6 h-10 w-auto"
              src={logoSrc}
            />
          ) : null}
          {theme.letterhead.headerHtml ? (
            <div
              className="mb-6 text-sm"
              dangerouslySetInnerHTML={{ __html: theme.letterhead.headerHtml }}
            />
          ) : null}
          {!resolved.ok ? (
            <p className="text-sm text-red-700">{resolved.error}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {resolved.result.document.blocks.map((block) => (
                <PrintBlock
                  headingFamily={css.headingFamily}
                  headingSize={css.headingSize}
                  headingWeight={css.headingWeight}
                  key={block.id}
                  text={(block.children ?? [])
                    .map((child) => child.text)
                    .join("")}
                  rows={(block.rows ?? []).map((row) =>
                    row.map((child) => child.text).join(""),
                  )}
                  type={block.type}
                />
              ))}
              {signatures.map((slot) => (
                <div className="mt-10 grid grid-cols-2 gap-10 text-sm" key={slot.id}>
                  <div>
                    {slot.imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="mb-2 h-10 w-auto"
                        src={slot.imageSrc}
                      />
                    ) : (
                      <p className="mb-10 border-b border-zinc-800" />
                    )}
                    <p>{slot.partyName ?? slot.partyLabel}</p>
                    <p className="text-xs text-zinc-500">{slot.partyLabel}</p>
                    {slot.includeTitle ? <p>{slot.title ?? "Title"}</p> : null}
                  </div>
                  {slot.includeDate ? (
                    <div>
                      <p className="mb-10 border-b border-zinc-800" />
                      <p>{slot.date ?? "Date"}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {theme.letterhead.footerMode === "pageNumbers" ? (
            <p className="mt-16 text-center text-xs text-zinc-500">1</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function PrintBlock({
  type,
  text,
  rows,
  headingFamily,
  headingSize,
  headingWeight,
}: {
  type: string;
  text: string;
  rows: string[];
  headingFamily: string;
  headingSize: string;
  headingWeight: string | number;
}) {
  if (type === "pageBreak") {
    return (
      <div className="my-8 border-t border-dashed border-zinc-400 text-center text-[10px] uppercase tracking-widest text-zinc-400">
        Page break
      </div>
    );
  }
  if (type === "heading") {
    return (
      <h1
        style={{
          fontFamily: headingFamily,
          fontSize: headingSize,
          fontWeight: headingWeight,
        }}
      >
        {text}
      </h1>
    );
  }
  if (type === "list") {
    const items = rows.length > 0 ? rows : text ? [text] : [];
    return (
      <ul className="list-disc pl-5">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
  if (type === "table") {
    const items = rows.length > 0 ? rows : text ? [text] : [];
    return (
      <table className="w-full border border-zinc-400 text-sm">
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="border border-zinc-400 p-2">{item}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (type === "signature") {
    return (
      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-8 border-b border-zinc-400" />
          <p>Signature</p>
        </div>
        <div>
          <p className="mb-8 border-b border-zinc-400" />
          <p>Date</p>
        </div>
      </div>
    );
  }
  if (type === "initials") {
    return (
      <div className="mt-6 flex items-end gap-2 text-sm">
        <span className="inline-block size-10 border border-zinc-400" />
        <span>Initials</span>
      </div>
    );
  }
  return <p className="leading-relaxed">{text}</p>;
}
