import { printPreviewAssetSrc } from "@/lib/document-types/print-preview";
import type { Answers } from "@/lib/expr/evaluate";
import type { SignatureSlot, StyleTheme } from "@/types/document-type";

export type ResolvedSignatureSlot = {
  id: string;
  kind: "signature" | "initials";
  partyLabel: string;
  partyName: string | null;
  title: string | null;
  date: string | null;
  includeTitle: boolean;
  includeDate: boolean;
  imageSrc: string | null;
};

function answerText(answers: Answers, field: string | undefined): string | null {
  if (!field) {
    return null;
  }
  const value = answers[field];
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function signatureImageSrc(slot: SignatureSlot, answers: Answers) {
  return (
    printPreviewAssetSrc(answerText(answers, slot.imageField) ?? undefined) ??
    printPreviewAssetSrc(slot.imageAssetId)
  );
}

export function resolveThemeSignatures(
  theme: StyleTheme,
  answers: Answers,
): ResolvedSignatureSlot[] {
  return theme.signatures.blocks.map((slot) => ({
    id: slot.id,
    kind: slot.kind ?? "signature",
    partyLabel: slot.partyLabel,
    partyName: answerText(answers, slot.partyNameField),
    title: slot.includeTitle ? answerText(answers, slot.titleField) : null,
    date: slot.includeDate ? answerText(answers, slot.dateField) : null,
    includeTitle: Boolean(slot.includeTitle),
    includeDate: Boolean(slot.includeDate),
    imageSrc: signatureImageSrc(slot, answers),
  }));
}
