import { emptyDraftSnapshot } from "@/lib/document-types/defaults";
import type { FamilyBundle } from "@/lib/document-types/import";
import {
  parseDocumentTypeVersionSnapshot,
  type Block,
  type DocumentTypeVersionSnapshot,
} from "@/types/document-type";

function blockText(block: Block) {
  return (block.children ?? [])
    .map((child) => {
      if (child.type === "text") {
        return child.text;
      }
      if (child.type === "variantMap") {
        return Object.values(child.variants).join(" ");
      }
      return "";
    })
    .join(" ")
    .trim();
}

export function emptyDraftBlockTexts() {
  return new Set(
    emptyDraftSnapshot().template.blocks.map((block) => blockText(block)),
  );
}

export function diffAgainstEmptyDraft(snapshot: DocumentTypeVersionSnapshot) {
  const empty = emptyDraftBlockTexts();
  return snapshot.template.blocks
    .filter((block) => block.type !== "heading")
    .map((block) => ({
      id: block.id,
      type: block.type,
      text: blockText(block),
      vsEmpty: empty.has(blockText(block)) ? "unchanged" : "added",
    }));
}

export function omitRejectedTemplateBlocks(
  snapshot: DocumentTypeVersionSnapshot,
  rejectedBlockIds: string[],
): DocumentTypeVersionSnapshot {
  const rejected = new Set(rejectedBlockIds);
  const blocks = snapshot.template.blocks.filter(
    (block) => block.type === "heading" || !rejected.has(block.id),
  );
  return parseDocumentTypeVersionSnapshot({
    ...snapshot,
    template: { ...snapshot.template, blocks },
  });
}

export function applyIngestReview(args: {
  familyDraft: FamilyBundle;
  rejectedBlockIds: string[];
}): FamilyBundle {
  return {
    ...args.familyDraft,
    members: args.familyDraft.members.map((member) => ({
      ...member,
      snapshot: omitRejectedTemplateBlocks(
        member.snapshot,
        args.rejectedBlockIds,
      ),
    })),
  };
}
