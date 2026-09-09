import {
  finalizeClassification,
  type IngestClassification,
} from "@/lib/ingest/classify";
import type { IngestCategory } from "@/lib/ingest/extract";

export const INGEST_REREVIEW_ACTIONS = [
  "exclude",
  "recategorize",
  "switch_to_decompose",
  "confirm_and_continue",
] as const;

export type IngestRereviewAction = (typeof INGEST_REREVIEW_ACTIONS)[number];

export const INGEST_HOLD_OUT_ACTIONS: IngestRereviewAction[] = [
  "exclude",
  "recategorize",
  "switch_to_decompose",
  "confirm_and_continue",
];

export class IngestRereviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestRereviewError";
  }
}

export function applyRereviewAction(args: {
  classification: IngestClassification;
  action: IngestRereviewAction;
  declaredCategory: IngestCategory;
  labels?: { category: IngestCategory; documentType: string };
}): IngestClassification {
  if (args.action === "exclude") {
    return {
      ...args.classification,
      holdout: true,
      inFamily: false,
      clusterEligible: false,
      needsAuthorAction: false,
      authorAction: "exclude",
    };
  }
  if (args.action === "confirm_and_continue") {
    return {
      ...args.classification,
      holdout: false,
      inFamily: true,
      clusterEligible: true,
      needsAuthorAction: false,
      authorAction: "confirm_and_continue",
      gateReason: undefined,
    };
  }
  if (args.action === "recategorize") {
    if (!args.labels) {
      throw new IngestRereviewError("Recategorize needs category and document type");
    }
    const next = finalizeClassification({
      labels: {
        category: args.labels.category,
        documentType: args.labels.documentType,
        confidence: 1,
        rationale: "Author recategorized after holdout review",
      },
      declaredCategory: args.declaredCategory,
      source: args.classification.source,
    });
    return {
      ...next,
      clusterEligible: !next.holdout,
      needsAuthorAction: next.holdout,
      authorAction: "recategorize",
    };
  }
  return {
    ...args.classification,
    authorAction: "switch_to_decompose",
    needsAuthorAction: false,
  };
}
