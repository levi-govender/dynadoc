import { randomUUID } from "node:crypto";
import type { DocumentTypeVersionSnapshot } from "@/types/document-type";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";

export const DEFAULT_GROUP_TITLE = "Details";

export function emptyDraftSnapshot(): DocumentTypeVersionSnapshot {
  const groupId = randomUUID();
  const headingId = randomUUID();
  const paragraphId = randomUUID();
  return parseDocumentTypeVersionSnapshot({
    schemaVersion: 1,
    expressionDialectVersion: 1,
    formSchema: {
      schemaVersion: 1,
      groups: [
        {
          id: groupId,
          title: DEFAULT_GROUP_TITLE,
          fields: [],
        },
      ],
    },
    template: {
      schemaVersion: 1,
      blocks: [
        {
          id: headingId,
          type: "heading",
          children: [{ type: "text", text: "Untitled document" }],
        },
        {
          id: paragraphId,
          type: "paragraph",
          children: [{ type: "text", text: "Start writing the contract." }],
        },
      ],
    },
    styleTheme: {
      schemaVersion: 1,
      page: {
        size: "A4",
        margins: { top: 72, right: 54, bottom: 72, left: 54 },
      },
      typography: {
        body: { family: "Times New Roman", size: 11 },
        heading: { family: "Times New Roman", size: 16, weight: 700 },
      },
      letterhead: { footerMode: "pageNumbers", logoAssetId: "placeholder-logo" },
      signatures: {
        blocks: [
          {
            id: "employee",
            partyLabel: "Employee",
            includeTitle: true,
            includeDate: true,
          },
        ],
      },
    },
  });
}

export function slugFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}
