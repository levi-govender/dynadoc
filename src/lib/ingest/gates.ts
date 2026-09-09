import type { IngestClassification } from "@/lib/ingest/classify";
import type { IngestMode } from "@/lib/ingest/extract";

export const RELATED_DOCUMENT_TYPE_GROUPS: readonly (readonly string[])[] = [
  ["employment", "nda"],
  ["lease"],
  ["policy"],
  ["invoice"],
];

export type IngestGateReason =
  | "classify_holdout"
  | "type_mismatch"
  | "unrelated_family_types"
  | "extract_error";

export type GatedIngestClassification = IngestClassification & {
  clusterEligible: boolean;
  gateReason?: IngestGateReason;
};

export type IngestGateHoldout = {
  fileId: string;
  filename: string;
  reason: IngestGateReason;
  documentType: string | null;
};

export type IngestGateFile = {
  id: string;
  filename: string;
  error: string | null;
  classification: IngestClassification | GatedIngestClassification | null;
};

function familyKey(documentType: string) {
  const group = RELATED_DOCUMENT_TYPE_GROUPS.find((types) =>
    types.includes(documentType),
  );
  if (group) {
    return group.join("+");
  }
  return `solo:${documentType}`;
}

function majorityType(types: string[]) {
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  return tied ? null : best;
}

function holdoutClassification(
  classification: IngestClassification,
  reason: IngestGateReason,
): GatedIngestClassification {
  return {
    ...classification,
    holdout: true,
    inFamily: false,
    clusterEligible: false,
    gateReason: reason,
  };
}

function passClassification(
  classification: IngestClassification,
): GatedIngestClassification {
  return {
    ...classification,
    clusterEligible: true,
    gateReason: undefined,
  };
}

export function applyIngestGates(args: {
  mode: IngestMode;
  files: IngestGateFile[];
}): {
  files: Array<IngestGateFile & { classification: GatedIngestClassification | null }>;
  holdouts: IngestGateHoldout[];
} {
  const holdouts: IngestGateHoldout[] = [];
  const result: Array<
    IngestGateFile & { classification: GatedIngestClassification | null }
  > = args.files.map((file) => {
    if (file.error || !file.classification) {
      if (file.error) {
        holdouts.push({
          fileId: file.id,
          filename: file.filename,
          reason: "extract_error",
          documentType: file.classification?.documentType ?? null,
        });
      }
      return {
        ...file,
        classification: file.classification
          ? {
              ...file.classification,
              clusterEligible: false,
              gateReason: "extract_error" as const,
            }
          : null,
      };
    }
    if (file.classification.holdout) {
      holdouts.push({
        fileId: file.id,
        filename: file.filename,
        reason: "classify_holdout",
        documentType: file.classification.documentType,
      });
      return {
        ...file,
        classification: {
          ...file.classification,
          clusterEligible: false,
          gateReason: "classify_holdout",
        },
      };
    }
    return { ...file, classification: file.classification };
  });

  const candidates = result.filter(
    (file) =>
      file.classification &&
      !file.classification.holdout &&
      !file.classification.gateReason,
  );

  const candidateIds = new Set(candidates.map((file) => file.id));

  let allowed = new Set<string>();
  let failReason: IngestGateReason = "type_mismatch";

  if (args.mode === "single_type") {
    const winner = majorityType(
      candidates.map((file) => file.classification!.documentType),
    );
    if (winner) {
      allowed = new Set(
        candidates
          .filter((file) => file.classification!.documentType === winner)
          .map((file) => file.id),
      );
    }
    failReason = "type_mismatch";
  } else {
    const familyCounts = new Map<string, string[]>();
    for (const file of candidates) {
      const key = familyKey(file.classification!.documentType);
      const ids = familyCounts.get(key) ?? [];
      ids.push(file.id);
      familyCounts.set(key, ids);
    }
    let bestKey: string | null = null;
    let bestCount = 0;
    let tied = false;
    for (const [key, ids] of familyCounts) {
      if (ids.length > bestCount) {
        bestKey = key;
        bestCount = ids.length;
        tied = false;
      } else if (ids.length === bestCount) {
        tied = true;
      }
    }
    failReason = "unrelated_family_types";
    if (bestKey && !tied) {
      allowed = new Set(familyCounts.get(bestKey));
    }
  }

  return {
    files: result.map((file) => {
      if (!candidateIds.has(file.id) || !file.classification) {
        return file as IngestGateFile & {
          classification: GatedIngestClassification | null;
        };
      }
      if (allowed.has(file.id)) {
        return {
          ...file,
          classification: passClassification(file.classification),
        };
      }
      holdouts.push({
        fileId: file.id,
        filename: file.filename,
        reason: failReason,
        documentType: file.classification.documentType,
      });
      return {
        ...file,
        classification: holdoutClassification(file.classification, failReason),
      };
    }),
    holdouts,
  };
}
