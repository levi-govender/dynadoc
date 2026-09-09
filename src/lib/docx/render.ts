import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ResolvedBlock, ResolvedDocument } from "@/lib/resolver/resolve";

function blockItems(block: ResolvedBlock): string[] {
  const text = (block.children ?? []).map((child) => child.text).join("");
  const rowTexts = (block.rows ?? []).map((row) =>
    row.map((child) => child.text).join(""),
  );
  if (block.type === "list" || block.type === "table") {
    return rowTexts.length > 0 ? rowTexts : text ? [text] : [];
  }
  return text ? [text] : [];
}

/** Same resolved AST the PDF uses; not a second template language. */
export function resolvedClauseTexts(document: ResolvedDocument): string[] {
  const clauses: string[] = [];
  for (const block of document.blocks) {
    if (
      block.type === "pageBreak" ||
      block.type === "signature" ||
      block.type === "initials"
    ) {
      continue;
    }
    if (block.type === "heading") {
      const [heading] = blockItems(block);
      if (heading) {
        clauses.push(heading);
      }
      continue;
    }
    clauses.push(...blockItems(block));
  }
  return clauses;
}

function numberedParagraph(text: string, index: number) {
  return new Paragraph({
    children: [new TextRun(`${index}. ${text}`)],
    spacing: { after: 200 },
  });
}

export async function renderDocumentDocx(args: {
  document: ResolvedDocument;
}): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];
  let clause = 0;

  for (const block of args.document.blocks) {
    const items = blockItems(block);
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          text: items[0] ?? "",
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        }),
      );
      continue;
    }
    if (block.type === "pageBreak") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      continue;
    }
    if (block.type === "signature" || block.type === "initials") {
      const label = block.type === "initials" ? "Initials" : "Signature";
      children.push(
        new Paragraph({
          children: [new TextRun("____________________")],
          spacing: { before: 400 },
        }),
        new Paragraph({ children: [new TextRun(label)] }),
      );
      continue;
    }
    if (block.type === "table") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: items.map(
            (item) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                    },
                    children: [new Paragraph({ children: [new TextRun(item)] })],
                  }),
                ],
              }),
          ),
        }),
      );
      continue;
    }
    for (const item of items) {
      clause += 1;
      children.push(numberedParagraph(item, clause));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children:
          children.length > 0
            ? children
            : [new Paragraph({ children: [new TextRun("")] })],
      },
    ],
  });

  const packed = await Packer.toBuffer(doc);
  return Buffer.from(packed);
}

export function issuedDocxFilename(slug: string, at: Date) {
  const stamp = at.toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `${slug}-${stamp}.docx`;
}
