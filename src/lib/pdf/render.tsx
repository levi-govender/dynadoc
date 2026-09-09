import "./hyphenate-cjs-patch";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ResolvedDocument } from "@/lib/resolver/resolve";
import type { Answers } from "@/lib/expr/evaluate";
import { resolveThemeSignatures } from "@/lib/document-types/signatures";
import type { StyleTheme } from "@/types/document-type";

/** Tiny PNG used when the theme asks for a placeholder logo. */
export const PLACEHOLDER_LOGO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function pageSize(theme: StyleTheme): "A4" | "LETTER" {
  return theme.page.size === "Letter" ? "LETTER" : "A4";
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clauseNumber(index: number) {
  return String(index + 1);
}

export type PdfLogo =
  | { kind: "png"; bytes: Buffer }
  | { kind: "none" };

export const DRAFT_PDF_WATERMARK = "DRAFT";

export async function renderDocumentPdf(args: {
  theme: StyleTheme;
  document: ResolvedDocument;
  logo: PdfLogo;
  answers?: Answers;
  draftWatermark?: boolean;
}): Promise<Buffer> {
  const { theme, document: resolved } = args;
  const signatures = resolveThemeSignatures(theme, args.answers ?? {});
  const margins = theme.page.margins;
  const bodySize = theme.typography.body.size;
  const headingSize = theme.typography.heading.size;
  const headerText = theme.letterhead.headerHtml
    ? stripHtml(theme.letterhead.headerHtml)
    : null;
  const logoSrc =
    args.logo.kind === "png"
      ? `data:image/png;base64,${args.logo.bytes.toString("base64")}`
      : null;
  let clause = 0;

  const pdfDoc = (
    <Document
      subject={args.draftWatermark ? DRAFT_PDF_WATERMARK : undefined}
    >
      <Page
        size={pageSize(theme)}
        style={{
          paddingTop: margins.top,
          paddingRight: margins.right,
          paddingBottom: margins.bottom + 24,
          paddingLeft: margins.left,
          fontFamily: "Times-Roman",
          fontSize: bodySize,
          lineHeight: 1.45,
        }}
      >
        {args.draftWatermark ? (
          <Text
            fixed
            style={{
              position: "absolute",
              top: 320,
              left: 48,
              opacity: 0.14,
              fontSize: 72,
              fontFamily: "Times-Bold",
              transform: "rotate(-32deg)",
            }}
          >
            {DRAFT_PDF_WATERMARK}
          </Text>
        ) : null}
        {logoSrc ? (
          // react-pdf Image has no alt prop
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={logoSrc} style={{ height: 36, width: 36, marginBottom: 12 }} />
        ) : null}
        {headerText ? (
          <Text style={{ marginBottom: 16, fontSize: bodySize }}>{headerText}</Text>
        ) : null}
        {resolved.blocks.map((block) => {
          const text = (block.children ?? []).map((child) => child.text).join("");
          if (block.type === "heading") {
            return (
              <Text
                key={block.id}
                style={{
                  fontFamily: "Times-Bold",
                  fontSize: headingSize,
                  marginBottom: 10,
                  marginTop: 8,
                }}
              >
                {text}
              </Text>
            );
          }
          if (block.type === "pageBreak") {
            return <View key={block.id} break />;
          }
          if (block.type === "signature" || block.type === "initials") {
            const label = block.type === "initials" ? "Initials" : "Signature";
            return (
              <View key={block.id} style={{ marginTop: 28 }}>
                {block.type === "initials" ? (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderWidth: 1,
                      borderColor: "#111",
                      marginBottom: 6,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#111",
                      width: 220,
                      marginBottom: 6,
                    }}
                  />
                )}
                <Text>{label}</Text>
              </View>
            );
          }
          clause += 1;
          const prefix = `${clauseNumber(clause - 1)}. `;
          if (block.type === "list") {
            return (
              <Text key={block.id} style={{ marginBottom: 8 }}>
                {prefix}
                {text}
              </Text>
            );
          }
          return (
            <Text key={block.id} style={{ marginBottom: 8 }}>
              {prefix}
              {text}
            </Text>
          );
        })}
        {signatures.map((slot) => (
          <View key={slot.id} style={{ marginTop: 36, flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              {slot.imageSrc ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  src={slot.imageSrc}
                  style={{ height: 36, width: 120, marginBottom: 6 }}
                />
              ) : (
                <View
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#111",
                    marginBottom: 6,
                    minHeight: slot.kind === "initials" ? 36 : 14,
                  }}
                />
              )}
              <Text>{slot.partyName ?? slot.partyLabel}</Text>
              <Text>{slot.partyLabel}</Text>
              {slot.includeTitle ? <Text>{slot.title ?? "Title"}</Text> : null}
            </View>
            {slot.includeDate ? (
              <View style={{ flex: 1, marginLeft: 24 }}>
                <View
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#111",
                    marginBottom: 6,
                  }}
                />
                <Text>{slot.date ?? "Date"}</Text>
              </View>
            ) : null}
          </View>
        ))}
        {theme.letterhead.footerMode === "pageNumbers" ? (
          <Text
            fixed
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            style={{
              position: "absolute",
              bottom: 24,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 9,
            }}
          />
        ) : headerText ? (
          <Text
            fixed
            style={{
              position: "absolute",
              bottom: 24,
              left: margins.left,
              fontSize: 9,
            }}
          >
            {headerText}
          </Text>
        ) : null}
      </Page>
    </Document>
  );

  return Buffer.from(await renderToBuffer(pdfDoc));
}

export function isPdfBuffer(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}
