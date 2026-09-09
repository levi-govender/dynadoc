import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import type { DocumentTypeVersionSnapshot, StyleTheme } from "@/types/document-type";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";

export type LayoutHints = {
  pageSize: "A4" | "Letter";
  logoPosition: "left" | "none";
  footerMode: "pageNumbers" | "letterhead";
  signatureCount: 1 | 2;
  dense: boolean;
  sampleExcerpt: string;
};

function firstLines(text: string, count: number) {
  return text.split(/\r?\n/).slice(0, count).join("\n");
}

function averageLineLength(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return 0;
  }
  return lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
}

/** Heuristic layout from wording, not a pixel-perfect scan clone. */
export function extractLayoutHints(texts: string[]): LayoutHints {
  const combined = texts.join("\n\n");
  const head = firstLines(combined, 12).toLowerCase();
  const looksUs =
    /\bletter size\b/.test(combined) ||
    /8\.5\s*[x×by]\s*11/i.test(combined) ||
    /\bunited states\b/i.test(combined) ||
    (/\b(street|avenue|blvd)\b/i.test(head) && /\b\d{5}(?:-\d{4})?\b/.test(head));
  const letterhead =
    /\b(pty ltd|incorporated|\bllc\b|letterhead)\b/i.test(head);
  const twoParties =
    /\b(employer|witness|counter-?sign|second party)\b/i.test(combined);
  const excerpt = combined.replace(/\s+/g, " ").trim().slice(0, 280);
  return {
    pageSize: looksUs ? "Letter" : "A4",
    logoPosition: letterhead ? "left" : "none",
    footerMode: letterhead ? "letterhead" : "pageNumbers",
    signatureCount: twoParties ? 2 : 1,
    dense: averageLineLength(combined) > 88,
    sampleExcerpt: excerpt,
  };
}

/** v1 stays in the default professional family and keeps a manual/placeholder logo. */
export function proposeStyleTheme(hints: LayoutHints): StyleTheme {
  const base = emptyDraftSnapshot().styleTheme;
  const pad = hints.dense ? 54 : 72;
  const side = hints.dense ? 48 : 54;
  const signatures =
    hints.signatureCount === 2
      ? {
          blocks: [
            {
              id: "employee",
              partyLabel: "Employee",
              includeTitle: true,
              includeDate: true,
            },
            {
              id: "employer",
              partyLabel: "Employer",
              includeTitle: true,
              includeDate: true,
            },
          ],
        }
      : base.signatures;
  return parseDocumentTypeVersionSnapshot({
    ...emptyDraftSnapshot(),
    styleTheme: {
      ...base,
      page: {
        size: hints.pageSize,
        margins: {
          top: pad,
          right: side,
          bottom: pad,
          left: side,
        },
      },
      letterhead: {
        ...base.letterhead,
        footerMode: hints.footerMode,
        logoAssetId:
          hints.logoPosition === "left"
            ? (base.letterhead.logoAssetId ?? "placeholder-logo")
            : base.letterhead.logoAssetId,
      },
      signatures,
    },
  }).styleTheme;
}

export function applyStyleThemeToDraft(
  snapshot: DocumentTypeVersionSnapshot,
  styleTheme: StyleTheme,
): DocumentTypeVersionSnapshot {
  return parseDocumentTypeVersionSnapshot({
    ...snapshot,
    styleTheme,
  });
}
