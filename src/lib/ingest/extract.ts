export const INGEST_CATEGORIES = ["contract", "policy", "other"] as const;
export const INGEST_MODES = ["single_type", "decompose"] as const;
export const INGEST_JOB_UPLOADED = "uploaded";
export const INGEST_JOB_CLASSIFIED = "classified";
export const INGEST_JOB_CLUSTERED = "clustered";
export const INGEST_MAX_FILES = 40;
export const INGEST_FILE_MAX_BYTES = 20 * 1024 * 1024;

export type IngestCategory = (typeof INGEST_CATEGORIES)[number];
export type IngestMode = (typeof INGEST_MODES)[number];

export class InvalidIngestMetaError extends Error {
  constructor(message = "Invalid ingest category or mode") {
    super(message);
    this.name = "InvalidIngestMetaError";
  }
}

export function stripLetterhead(text: string) {
  const lines = text.split(/\r?\n/);
  let skip = 0;
  while (skip < Math.min(8, lines.length)) {
    const line = lines[skip]!.trim().toLowerCase();
    if (
      !line ||
      line.includes("logo") ||
      line.includes("letterhead") ||
      /pty ltd|incorporated|\bllc\b|\bstreet\b|\bavenue\b/.test(line)
    ) {
      skip += 1;
      continue;
    }
    break;
  }
  return lines.slice(skip).join("\n");
}

export function parseIngestCategory(value: unknown): IngestCategory {
  if (
    typeof value === "string" &&
    (INGEST_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as IngestCategory;
  }
  throw new InvalidIngestMetaError("Unknown ingest category");
}

export function parseIngestMode(value: unknown): IngestMode {
  if (
    typeof value === "string" &&
    (INGEST_MODES as readonly string[]).includes(value)
  ) {
    return value as IngestMode;
  }
  throw new InvalidIngestMetaError("Unknown ingest mode");
}

export type IngestFileKind = "pdf" | "docx" | "unsupported";

export function ingestFileKind(
  filename: string,
  contentType: string,
): IngestFileKind {
  const lower = filename.toLowerCase();
  const type = contentType.toLowerCase();
  if (lower.endsWith(".pdf") || type === "application/pdf") {
    return "pdf";
  }
  if (
    lower.endsWith(".docx") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "unsupported";
}

export async function extractIngestText(args: {
  filename: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{
  kind: IngestFileKind;
  text: string | null;
  sampleImage: Buffer | null;
  error: string | null;
}> {
  const kind = ingestFileKind(args.filename, args.contentType);
  if (kind === "unsupported") {
    return {
      kind,
      text: null,
      sampleImage: null,
      error: `Unsupported file type: ${args.filename}`,
    };
  }
  try {
    if (kind === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: Uint8Array.from(args.bytes) });
      try {
        const text = await parser.getText();
        let sampleImage: Buffer | null = null;
        try {
          const shot = await parser.getScreenshot({
            first: 1,
            imageBuffer: true,
          });
          const page = shot.pages[0];
          if (page?.data) {
            sampleImage = Buffer.from(page.data);
          }
        } catch {
          sampleImage = null;
        }
        return { kind, text: text.text ?? "", sampleImage, error: null };
      } finally {
        await parser.destroy();
      }
    }
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: args.bytes });
    return {
      kind,
      text: result.value ?? "",
      sampleImage: null,
      error: null,
    };
  } catch {
    return {
      kind,
      text: null,
      sampleImage: null,
      error: `Could not extract text from ${args.filename}`,
    };
  }
}
