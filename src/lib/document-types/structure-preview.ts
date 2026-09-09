import {
  GroupActivationCycleError,
  resolveDocument,
  type ResolveResult,
} from "@/lib/resolver/resolve";
import type { Answers } from "@/lib/expr/evaluate";
import type { DocumentTypeVersionSnapshot } from "@/types/document-type";

export type StudioResolve =
  | { ok: true; result: ResolveResult }
  | { ok: false; error: string };

export function studioResolve(
  snapshot: DocumentTypeVersionSnapshot,
  answers: Answers,
): StudioResolve {
  try {
    return { ok: true, result: resolveDocument(snapshot, answers) };
  } catch (error) {
    if (error instanceof GroupActivationCycleError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export function resolvedBlockText(
  result: ResolveResult,
  blockId: string,
): string | undefined {
  const block = result.document.blocks.find((entry) => entry.id === blockId);
  if (!block) {
    return undefined;
  }
  if (block.rows && block.rows.length > 0) {
    return block.rows
      .map((row) => row.map((child) => child.text).join(""))
      .join("\n");
  }
  return (block.children ?? []).map((child) => child.text).join("");
}
