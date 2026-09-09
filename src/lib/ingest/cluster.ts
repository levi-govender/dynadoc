import { randomUUID } from "node:crypto";
import type { IngestClassification } from "@/lib/ingest/classify";
import { slugFromName } from "@/lib/document-types/defaults";
import type { FamilyBundle } from "@/lib/document-types/import";
import { stripLetterhead } from "@/lib/ingest/extract";
import { buildDraftTreeSnapshot } from "@/lib/ingest/draft-tree";

export type IngestCluster = {
  id: string;
  documentTypes: string[];
  fileIds: string[];
};

export type IngestSharedField = {
  id: string;
  label: string;
  type: "text" | "date";
};

export type IngestDiscriminator = {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

export type IngestClusterState = {
  clusters: IngestCluster[];
  discriminator: IngestDiscriminator | null;
  sharedFields: IngestSharedField[];
  familyDraft: FamilyBundle;
  published: false;
};

export type ClusterSourceFile = {
  id: string;
  filename: string;
  extractedText: string | null;
  classification: IngestClassification | null;
};

export class IngestClusterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestClusterError";
  }
}

export { stripLetterhead } from "@/lib/ingest/extract";

function titleCase(value: string) {
  return value.replace(/^\w/, (char) => char.toUpperCase());
}

export function eligibleClusterFiles(files: ClusterSourceFile[]) {
  return files.filter((file) => {
    const labels = file.classification;
    return Boolean(
      labels?.clusterEligible &&
        !labels.holdout &&
        file.extractedText &&
        !file.filename.toLowerCase().endsWith(".png"),
    );
  });
}

function extractCompany(text: string) {
  const match = stripLetterhead(text).match(/company:\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractDate(text: string) {
  const match = stripLetterhead(text).match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function sharedFieldsFromFiles(files: ClusterSourceFile[]): IngestSharedField[] {
  const companies = files
    .map((file) => extractCompany(file.extractedText ?? ""))
    .filter((value): value is string => Boolean(value));
  const dates = files
    .map((file) => extractDate(file.extractedText ?? ""))
    .filter((value): value is string => Boolean(value));
  const fields: IngestSharedField[] = [];
  if (
    companies.length === files.length &&
    new Set(companies).size === 1
  ) {
    fields.push({ id: "company", label: "Company", type: "text" });
  }
  if (dates.length === files.length && new Set(dates).size === 1) {
    fields.push({ id: "startDate", label: "Start date", type: "date" });
  }
  return fields;
}

function discriminatorFromTypes(types: string[]): IngestDiscriminator | null {
  const unique = [...new Set(types)].sort();
  if (unique.length < 2) {
    return null;
  }
  return {
    id: "engagementType",
    label: "Engagement type",
    options: unique.map((value) => ({
      value,
      label: titleCase(value),
    })),
  };
}

function textsForCluster(
  cluster: IngestCluster,
  files: ClusterSourceFile[],
) {
  const byId = new Map(files.map((file) => [file.id, file]));
  return cluster.fileIds
    .map((id) => byId.get(id)?.extractedText)
    .filter((text): text is string => Boolean(text));
}

export function buildFamilyDraft(args: {
  clusters: IngestCluster[];
  discriminator: IngestDiscriminator | null;
  sharedFields: IngestSharedField[];
  files: ClusterSourceFile[];
}): FamilyBundle {
  const branched =
    args.clusters.length === 1 && args.clusters[0]!.documentTypes.length > 1;
  const members = branched
    ? [
        {
          name: args.clusters[0]!.documentTypes.map(titleCase).join(" / "),
          slug: slugFromName(args.clusters[0]!.documentTypes.join("-")) || "member",
          snapshot: buildDraftTreeSnapshot({
            name: args.clusters[0]!.documentTypes.map(titleCase).join(" / "),
            texts: textsForCluster(args.clusters[0]!, args.files),
            branchTypes: args.clusters[0]!.documentTypes,
            discriminatorId: args.discriminator?.id,
          }),
        },
      ]
    : args.clusters.map((cluster) => {
        const type = cluster.documentTypes[0] ?? "member";
        return {
          name: titleCase(type),
          slug: slugFromName(type) || "member",
          snapshot: buildDraftTreeSnapshot({
            name: titleCase(type),
            texts: textsForCluster(cluster, args.files),
          }),
        };
      });
  return {
    kind: "family",
    name: "Ingest family draft",
    slug: "ingest-family-draft",
    discriminator: args.discriminator ?? undefined,
    sharedFieldGroups:
      args.sharedFields.length > 0
        ? [
            {
              id: "family-shared",
              title: "Shared",
              fields: args.sharedFields.map((field) => ({
                id: field.id,
                label: field.label,
                type: field.type,
              })),
            },
          ]
        : undefined,
    members,
  };
}

export function proposeIngestClusters(
  files: ClusterSourceFile[],
): IngestClusterState {
  const eligible = eligibleClusterFiles(files);
  if (eligible.length === 0) {
    throw new IngestClusterError(
      "No cluster-eligible files. Held-out files cannot enter clustering.",
    );
  }
  const byType = new Map<string, string[]>();
  for (const file of eligible) {
    const type = file.classification!.documentType;
    const ids = byType.get(type) ?? [];
    ids.push(file.id);
    byType.set(type, ids);
  }
  const clusters: IngestCluster[] = [...byType.entries()].map(
    ([documentType, fileIds]) => ({
      id: randomUUID(),
      documentTypes: [documentType],
      fileIds,
    }),
  );
  const discriminator = discriminatorFromTypes(
    clusters.flatMap((cluster) => cluster.documentTypes),
  );
  const shared = sharedFieldsFromFiles(eligible);
  return {
    clusters,
    discriminator,
    sharedFields: shared,
    familyDraft: buildFamilyDraft({
      clusters,
      discriminator,
      sharedFields: shared,
      files,
    }),
    published: false,
  };
}

export function mergeIngestClusters(
  state: IngestClusterState,
  clusterIds: string[],
  files: ClusterSourceFile[] = [],
): IngestClusterState {
  if (clusterIds.length !== 2) {
    throw new IngestClusterError("Merge exactly two clusters");
  }
  const [leftId, rightId] = clusterIds;
  const left = state.clusters.find((cluster) => cluster.id === leftId);
  const right = state.clusters.find((cluster) => cluster.id === rightId);
  if (!left || !right) {
    throw new IngestClusterError("Unknown cluster");
  }
  const merged: IngestCluster = {
    id: randomUUID(),
    documentTypes: [...new Set([...left.documentTypes, ...right.documentTypes])],
    fileIds: [...left.fileIds, ...right.fileIds],
  };
  const clusters = [
    merged,
    ...state.clusters.filter(
      (cluster) => cluster.id !== left.id && cluster.id !== right.id,
    ),
  ];
  const discriminator = discriminatorFromTypes(
    clusters.flatMap((cluster) => cluster.documentTypes),
  );
  return {
    clusters,
    discriminator,
    sharedFields: state.sharedFields,
    familyDraft: buildFamilyDraft({
      clusters,
      discriminator,
      sharedFields: state.sharedFields,
      files,
    }),
    published: false,
  };
}

export function splitIngestCluster(
  state: IngestClusterState,
  clusterId: string,
  files: ClusterSourceFile[],
): IngestClusterState {
  const cluster = state.clusters.find((row) => row.id === clusterId);
  if (!cluster) {
    throw new IngestClusterError("Unknown cluster");
  }
  if (cluster.documentTypes.length < 2) {
    throw new IngestClusterError("Cluster is already a single type");
  }
  const fileById = new Map(files.map((file) => [file.id, file]));
  const byType = new Map<string, string[]>();
  for (const fileId of cluster.fileIds) {
    const type =
      fileById.get(fileId)?.classification?.documentType ??
      cluster.documentTypes[0]!;
    const ids = byType.get(type) ?? [];
    ids.push(fileId);
    byType.set(type, ids);
  }
  const splitClusters: IngestCluster[] = [...byType.entries()].map(
    ([documentType, fileIds]) => ({
      id: randomUUID(),
      documentTypes: [documentType],
      fileIds,
    }),
  );
  const clusters = [
    ...splitClusters,
    ...state.clusters.filter((row) => row.id !== clusterId),
  ];
  const discriminator = discriminatorFromTypes(
    clusters.flatMap((row) => row.documentTypes),
  );
  return {
    clusters,
    discriminator,
    sharedFields: state.sharedFields,
    familyDraft: buildFamilyDraft({
      clusters,
      discriminator,
      sharedFields: state.sharedFields,
      files,
    }),
    published: false,
  };
}
