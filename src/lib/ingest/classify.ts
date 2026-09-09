import { z } from "zod";
import {
  INGEST_CATEGORIES,
  type IngestCategory,
} from "@/lib/ingest/extract";

export const INGEST_LOW_CONFIDENCE = 0.6;

export const ingestClassificationSchema = z.object({
  category: z.enum(["contract", "policy", "other"]),
  documentType: z.string().min(1).max(80),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
});

export type IngestClassificationLabels = z.infer<
  typeof ingestClassificationSchema
>;

export type IngestClassification = IngestClassificationLabels & {
  holdout: boolean;
  inFamily: boolean;
  source: "heuristic" | "llm";
  clusterEligible?: boolean;
  gateReason?: string;
  needsAuthorAction?: boolean;
  authorAction?:
    | "exclude"
    | "recategorize"
    | "switch_to_decompose"
    | "confirm_and_continue";
};

export function finalizeClassification(args: {
  labels: IngestClassificationLabels;
  declaredCategory: IngestCategory;
  source: "heuristic" | "llm";
}): IngestClassification {
  const lowConfidence = args.labels.confidence < INGEST_LOW_CONFIDENCE;
  const categoryMismatch = args.labels.category !== args.declaredCategory;
  const holdout = lowConfidence || categoryMismatch;
  const inFamily = !holdout;
  return { ...args.labels, holdout, inFamily, source: args.source };
}

function hits(text: string, words: string[]) {
  return words.reduce(
    (count, word) => count + (text.includes(word) ? 1 : 0),
    0,
  );
}

export function heuristicClassify(args: {
  text: string;
  filename: string;
}): IngestClassificationLabels {
  const blob = `${args.filename}\n${args.text}`.toLowerCase();
  const invoice = hits(blob, [
    "invoice",
    "vat",
    "amount due",
    "bill to",
    "tax invoice",
  ]);
  const employment = hits(blob, [
    "employment",
    "notice period",
    "job title",
    "employee",
    "employer",
  ]);
  const contractor = hits(blob, [
    "independent contractor",
    "consultancy",
    "contractor agreement",
    "not an employee",
  ]);
  const nda = hits(blob, [
    "non-disclosure",
    "nda",
    "confidential information",
  ]);
  const policy = hits(blob, ["policy", "procedure", "handbook"]);
  const lease = hits(blob, ["lease", "landlord", "premises"]);

  if (invoice >= 2 && invoice >= employment) {
    return {
      category: "other",
      documentType: "invoice",
      confidence: Math.min(0.95, 0.7 + invoice * 0.05),
      rationale:
        "Invoice wording (amount due / VAT / bill to) is not an in-family contract.",
    };
  }
  if (nda >= 2) {
    return {
      category: "contract",
      documentType: "nda",
      confidence: 0.82,
      rationale: "Non-disclosure / confidential information language.",
    };
  }
  if (contractor >= 2) {
    return {
      category: "contract",
      documentType: "contractor",
      confidence: 0.8,
      rationale: "Independent contractor / consultancy language.",
    };
  }
  if (employment >= 2) {
    return {
      category: "contract",
      documentType: "employment",
      confidence: 0.8,
      rationale: "Employment / notice / employer-employee language.",
    };
  }
  if (lease >= 2) {
    return {
      category: "contract",
      documentType: "lease",
      confidence: 0.78,
      rationale: "Lease / landlord / premises language.",
    };
  }
  if (policy >= 2) {
    return {
      category: "policy",
      documentType: "policy",
      confidence: 0.76,
      rationale: "Policy / procedure / handbook language.",
    };
  }
  return {
    category: "other",
    documentType: "unknown",
    confidence: 0.28,
    rationale: "Too few type markers for a high-confidence label.",
  };
}

const llmResponseSchema = z.object({
  category: z.enum(["contract", "policy", "other"]),
  type: z.string().min(1).max(80),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
});

export async function classifyIngestFile(args: {
  extractedText: string;
  filename: string;
  declaredCategory: IngestCategory;
  /** Injected for tests. Production may call an LLM with only this file's text. */
  llm?: (prompt: { filename: string; text: string; declaredCategory: IngestCategory }) => Promise<unknown>;
}): Promise<IngestClassification> {
  const heuristic = heuristicClassify({
    text: args.extractedText,
    filename: args.filename,
  });
  if (!args.llm) {
    return finalizeClassification({
      labels: heuristic,
      declaredCategory: args.declaredCategory,
      source: "heuristic",
    });
  }
  try {
    const raw = await args.llm({
      filename: args.filename,
      text: args.extractedText.slice(0, 12_000),
      declaredCategory: args.declaredCategory,
    });
    const parsed = llmResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return finalizeClassification({
        labels: heuristic,
        declaredCategory: args.declaredCategory,
        source: "heuristic",
      });
    }
    return finalizeClassification({
      labels: {
        category: parsed.data.category,
        documentType: parsed.data.type,
        confidence: parsed.data.confidence,
        rationale: parsed.data.rationale,
      },
      declaredCategory: args.declaredCategory,
      source: "llm",
    });
  } catch {
    return finalizeClassification({
      labels: heuristic,
      declaredCategory: args.declaredCategory,
      source: "heuristic",
    });
  }
}

export function ingestClassifyPrompt(args: {
  filename: string;
  text: string;
  declaredCategory: IngestCategory;
}) {
  return {
    role: "user" as const,
    content: [
      "Return JSON only with keys category, type, confidence, rationale.",
      `category must be one of: ${INGEST_CATEGORIES.join(", ")}.`,
      "type is a short document-type label (employment, contractor, nda, invoice, lease, policy, unknown).",
      "confidence is 0 to 1. Do not treat invoices as in-family contracts.",
      `Declared job category: ${args.declaredCategory}.`,
      `Filename: ${args.filename}`,
      "Document text (this file only, this tenant only):",
      args.text,
    ].join("\n"),
  };
}

export async function classifyWithOpenAi(args: {
  filename: string;
  text: string;
  declaredCategory: IngestCategory;
}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const prompt = ingestClassifyPrompt(args);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify one document for one tenant. Never use other files or tenants. JSON keys: category, type, confidence, rationale.",
        },
        prompt,
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI classify failed: ${response.status}`);
  }
  const body: unknown = await response.json();
  const content =
    body &&
    typeof body === "object" &&
    "choices" in body &&
    Array.isArray(body.choices)
      ? (body.choices[0] as { message?: { content?: string } })?.message
          ?.content
      : null;
  if (typeof content !== "string") {
    throw new Error("OpenAI classify returned no JSON");
  }
  return JSON.parse(content) as unknown;
}
