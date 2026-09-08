import type { StyleTheme } from "@/types/document-type";

/** Inline mark used when theme.letterhead.logoAssetId is set but not a URL. */
export const PLACEHOLDER_LOGO_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" viewBox="0 0 160 40"><rect width="160" height="40" fill="#111"/><text x="12" y="26" fill="#fff" font-family="Times New Roman, serif" font-size="16">Logo</text></svg>`,
  );

export function printPreviewAssetSrc(id: string | undefined | null): string | null {
  const trimmed = id?.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  return PLACEHOLDER_LOGO_SRC;
}

export function printPreviewLogoSrc(theme: StyleTheme): string | null {
  return printPreviewAssetSrc(theme.letterhead.logoAssetId);
}

export function printPreviewPageCss(theme: StyleTheme) {
  const { margins, size } = theme.page;
  const width = size === "Letter" ? "8.5in" : "210mm";
  const minHeight = size === "Letter" ? "11in" : "297mm";
  return {
    width,
    minHeight,
    paddingTop: `${margins.top / 72}in`,
    paddingRight: `${margins.right / 72}in`,
    paddingBottom: `${margins.bottom / 72}in`,
    paddingLeft: `${margins.left / 72}in`,
    fontFamily: theme.typography.body.family,
    fontSize: `${theme.typography.body.size}pt`,
    headingFamily: theme.typography.heading.family,
    headingSize: `${theme.typography.heading.size}pt`,
    headingWeight: theme.typography.heading.weight ?? 700,
  };
}
