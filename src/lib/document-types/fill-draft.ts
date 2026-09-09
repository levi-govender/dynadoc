import type { Answers } from "@/lib/expr/evaluate";

export type FillDraft = {
  answers: Answers;
  step: number;
};

export function fillDraftStorageKey(documentTypeId: string) {
  return `dynadoc-fill:${documentTypeId}`;
}

export function parseFillDraft(raw: string | null): FillDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as { answers?: unknown; step?: unknown };
    if (!record.answers || typeof record.answers !== "object") {
      return null;
    }
    const step =
      typeof record.step === "number" && Number.isFinite(record.step)
        ? Math.max(0, Math.floor(record.step))
        : 0;
    return { answers: record.answers as Answers, step };
  } catch {
    return null;
  }
}

export function serializeFillDraft(draft: FillDraft) {
  return JSON.stringify(draft);
}

export function readFillDraft(documentTypeId: string): FillDraft | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    return parseFillDraft(
      sessionStorage.getItem(fillDraftStorageKey(documentTypeId)),
    );
  } catch {
    return null;
  }
}

export function writeFillDraft(documentTypeId: string, draft: FillDraft) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      fillDraftStorageKey(documentTypeId),
      serializeFillDraft(draft),
    );
  } catch {
    // Quota or private mode — filling still works in memory.
  }
}

export function clearFillDraft(documentTypeId: string) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(fillDraftStorageKey(documentTypeId));
  } catch {
    return;
  }
}
