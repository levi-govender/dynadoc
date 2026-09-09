import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { ingestJobFiles, ingestJobs } from "@/lib/db/schema";
import { organizationEq, withOrganization } from "@/lib/db/tenant";
import {
  extractIngestText,
  INGEST_FILE_MAX_BYTES,
  INGEST_JOB_CLASSIFIED,
  INGEST_JOB_CLUSTERED,
  INGEST_JOB_UPLOADED,
  INGEST_MAX_FILES,
  parseIngestCategory,
  parseIngestMode,
  type IngestCategory,
  type IngestMode,
} from "@/lib/ingest/extract";
import {
  classifyIngestFile,
  classifyWithOpenAi,
  type IngestClassification,
} from "@/lib/ingest/classify";
import { applyIngestGates } from "@/lib/ingest/gates";
import {
  mergeIngestClusters,
  proposeIngestClusters,
  splitIngestCluster,
  type IngestClusterState,
} from "@/lib/ingest/cluster";
import { notify } from "@/lib/notifications";
import { PDF_MAX_BYTES, buildObjectKey, ensureBucket, putObject } from "@/lib/storage";

export class IngestJobNotFoundError extends Error {
  constructor(message = "Ingest job not found") {
    super(message);
    this.name = "IngestJobNotFoundError";
  }
}

export class IngestUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestUploadError";
  }
}

export type IngestUploadFile = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export function ingestFileObjectKey(args: {
  organizationId: string;
  jobId: string;
  fileId: string;
  filename: string;
}) {
  const ext = args.filename.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
  return buildObjectKey(
    args.organizationId,
    "ingest",
    args.jobId,
    `${args.fileId}.${ext}`,
  );
}

export async function createIngestJob(args: {
  organizationId: string;
  category: unknown;
  mode: unknown;
  files: IngestUploadFile[];
}) {
  const category = parseIngestCategory(args.category);
  const mode = parseIngestMode(args.mode);
  if (args.files.length === 0) {
    throw new IngestUploadError("At least one file is required");
  }
  if (args.files.length > INGEST_MAX_FILES) {
    throw new IngestUploadError(`At most ${INGEST_MAX_FILES} files per job`);
  }

  const job = await withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .insert(ingestJobs)
      .values({
        organizationId: args.organizationId,
        status: INGEST_JOB_UPLOADED,
        payload: { category, mode },
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create ingest job");
    }
    return row;
  });

  const files = [];
  for (const file of args.files) {
    files.push(
      await storeIngestFile({
        organizationId: args.organizationId,
        jobId: job.id,
        file,
      }),
    );
  }
  return { job, files, category, mode };
}

async function storeIngestFile(args: {
  organizationId: string;
  jobId: string;
  file: IngestUploadFile;
}) {
  const extracted = await extractIngestText({
    filename: args.file.filename,
    contentType: args.file.contentType,
    bytes: args.file.bytes,
  });
  let objectKey: string | null = null;
  let sampleImageKey: string | null = null;
  let error = extracted.error;
  if (!error && args.file.bytes.byteLength > INGEST_FILE_MAX_BYTES) {
    error = `File exceeds ${INGEST_FILE_MAX_BYTES} bytes`;
  }
  if (!error) {
    const fileId = randomUUID();
    const key = ingestFileObjectKey({
      organizationId: args.organizationId,
      jobId: args.jobId,
      fileId,
      filename: args.file.filename,
    });
    try {
      await ensureBucket();
      await putObject({
        key,
        body: args.file.bytes,
        contentType: args.file.contentType || "application/octet-stream",
        maxBytes: PDF_MAX_BYTES,
      });
      objectKey = key;
      if (extracted.sampleImage) {
        const imageKey = buildObjectKey(
          args.organizationId,
          "ingest",
          args.jobId,
          `${fileId}-page1.png`,
        );
        await putObject({
          key: imageKey,
          body: extracted.sampleImage,
          contentType: "image/png",
          maxBytes: PDF_MAX_BYTES,
        });
        sampleImageKey = imageKey;
      }
    } catch {
      error = "Could not store file";
    }
  }

  return withOrganization(args.organizationId, async (db) => {
    const [row] = await db
      .insert(ingestJobFiles)
      .values({
        organizationId: args.organizationId,
        ingestJobId: args.jobId,
        filename: args.file.filename,
        contentType: args.file.contentType,
        objectKey,
        extractedText: extracted.text,
        sampleImageKey,
        error,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to record ingest file");
    }
    return row;
  });
}

export async function getIngestJob(args: {
  organizationId: string;
  jobId: string;
}) {
  return withOrganization(args.organizationId, async (db) => {
    const [job] = await db
      .select()
      .from(ingestJobs)
      .where(
        and(
          eq(ingestJobs.id, args.jobId),
          organizationEq(ingestJobs.organizationId, args.organizationId),
        ),
      )
      .limit(1);
    if (!job) {
      throw new IngestJobNotFoundError();
    }
    const files = await db
      .select()
      .from(ingestJobFiles)
      .where(
        and(
          eq(ingestJobFiles.ingestJobId, args.jobId),
          organizationEq(ingestJobFiles.organizationId, args.organizationId),
        ),
      )
      .orderBy(ingestJobFiles.createdAt);
    const payload = job.payload as {
      category?: IngestCategory;
      mode?: IngestMode;
      gatesApplied?: boolean;
      clusterState?: IngestClusterState;
    };
    return {
      job,
      files,
      category: payload.category,
      mode: payload.mode,
      gatesApplied: Boolean(payload.gatesApplied),
      clusterState: payload.clusterState ?? null,
    };
  });
}

export async function classifyIngestJob(args: {
  organizationId: string;
  jobId: string;
  userId?: string;
}) {
  const loaded = await getIngestJob(args);
  if (!loaded.category) {
    throw new IngestUploadError("Ingest job is missing a declared category");
  }
  if (!loaded.mode) {
    throw new IngestUploadError("Ingest job is missing a declared mode");
  }
  const declaredCategory = loaded.category;
  for (const file of loaded.files) {
    if (file.error || !file.extractedText) {
      continue;
    }
    const classification = await classifyIngestFile({
      extractedText: file.extractedText,
      filename: file.filename,
      declaredCategory,
      llm:
        process.env.INGEST_LLM === "openai" && process.env.OPENAI_API_KEY
          ? classifyWithOpenAi
          : undefined,
    });
    await withOrganization(args.organizationId, async (db) => {
      await db
        .update(ingestJobFiles)
        .set({ classification })
        .where(
          and(
            eq(ingestJobFiles.id, file.id),
            organizationEq(ingestJobFiles.organizationId, args.organizationId),
          ),
        );
    });
  }
  const classified = await getIngestJob(args);
  const gated = applyIngestGates({
    mode: loaded.mode,
    files: classified.files,
  });
  for (const file of gated.files) {
    await withOrganization(args.organizationId, async (db) => {
      await db
        .update(ingestJobFiles)
        .set({ classification: file.classification })
        .where(
          and(
            eq(ingestJobFiles.id, file.id),
            organizationEq(ingestJobFiles.organizationId, args.organizationId),
          ),
        );
    });
  }
  const nextPayload = {
    ...(classified.job.payload as Record<string, unknown>),
    category: loaded.category,
    mode: loaded.mode,
    gatesApplied: true,
  };
  await withOrganization(args.organizationId, async (db) => {
    await db
      .update(ingestJobs)
      .set({ status: INGEST_JOB_CLASSIFIED, payload: nextPayload })
      .where(
        and(
          eq(ingestJobs.id, args.jobId),
          organizationEq(ingestJobs.organizationId, args.organizationId),
        ),
      );
  });
  const mismatchHoldouts = gated.holdouts.filter(
    (holdout) => holdout.reason !== "extract_error",
  );
  if (args.userId && mismatchHoldouts.length > 0) {
    await notify({
      organizationId: args.organizationId,
      userId: args.userId,
      type: "ingest_holdout",
      payload: {
        jobId: args.jobId,
        query: `ingest_job:${args.jobId}:holdout`,
        files: mismatchHoldouts,
      },
    });
  }
  return getIngestJob(args);
}

async function saveClusterState(args: {
  organizationId: string;
  jobId: string;
  loaded: Awaited<ReturnType<typeof getIngestJob>>;
  clusterState: IngestClusterState;
}) {
  const nextPayload = {
    ...(args.loaded.job.payload as Record<string, unknown>),
    category: args.loaded.category,
    mode: args.loaded.mode,
    gatesApplied: args.loaded.gatesApplied,
    clusterState: args.clusterState,
    published: false,
  };
  await withOrganization(args.organizationId, async (db) => {
    await db
      .update(ingestJobs)
      .set({ status: INGEST_JOB_CLUSTERED, payload: nextPayload })
      .where(
        and(
          eq(ingestJobs.id, args.jobId),
          organizationEq(ingestJobs.organizationId, args.organizationId),
        ),
      );
  });
}

export async function clusterIngestJob(args: {
  organizationId: string;
  jobId: string;
}) {
  const loaded = await getIngestJob(args);
  if (!loaded.gatesApplied) {
    throw new IngestUploadError("Run classify and gates before clustering");
  }
  const clusterState = proposeIngestClusters(loaded.files);
  await saveClusterState({ ...args, loaded, clusterState });
  return getIngestJob(args);
}

export async function mergeIngestJobClusters(args: {
  organizationId: string;
  jobId: string;
  clusterIds: string[];
}) {
  const loaded = await getIngestJob(args);
  if (!loaded.clusterState) {
    throw new IngestUploadError("Cluster the job before merging");
  }
  const clusterState = mergeIngestClusters(
    loaded.clusterState,
    args.clusterIds,
  );
  await saveClusterState({ ...args, loaded, clusterState });
  return getIngestJob(args);
}

export async function splitIngestJobCluster(args: {
  organizationId: string;
  jobId: string;
  clusterId: string;
}) {
  const loaded = await getIngestJob(args);
  if (!loaded.clusterState) {
    throw new IngestUploadError("Cluster the job before splitting");
  }
  const clusterState = splitIngestCluster(
    loaded.clusterState,
    args.clusterId,
    loaded.files,
  );
  await saveClusterState({ ...args, loaded, clusterState });
  return getIngestJob(args);
}

export async function listIngestJobs(args: { organizationId: string }) {
  return withOrganization(args.organizationId, async (db) => {
    return db
      .select()
      .from(ingestJobs)
      .where(organizationEq(ingestJobs.organizationId, args.organizationId))
      .orderBy(desc(ingestJobs.createdAt));
  });
}

export function serializeIngestJob(args: {
  job: { id: string; status: string; createdAt: Date };
  files: Array<{
    id: string;
    filename: string;
    error: string | null;
    extractedText: string | null;
    classification?: unknown;
  }>;
  category?: string;
  mode?: string;
  gatesApplied?: boolean;
  clusterState?: IngestClusterState | null;
}) {
  return {
    id: args.job.id,
    status: args.job.status,
    category: args.category ?? null,
    mode: args.mode ?? null,
    gatesApplied: Boolean(args.gatesApplied),
    clusterState: args.clusterState ?? null,
    published: false,
    createdAt: args.job.createdAt.toISOString(),
    files: args.files.map((file) => ({
      id: file.id,
      filename: file.filename,
      error: file.error,
      extracted: Boolean(file.extractedText),
      classification: (file.classification ?? null) as IngestClassification | null,
    })),
  };
}
