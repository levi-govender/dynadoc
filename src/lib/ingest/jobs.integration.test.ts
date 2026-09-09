import assert from "node:assert/strict";
import { after } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { createIngestJob, classifyIngestJob, getIngestJob } from "./jobs";
import { INGEST_JOB_CLASSIFIED, INGEST_JOB_UPLOADED } from "./extract";
import { ingestJobFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withOrganization } from "@/lib/db/tenant";

config({ path: ".env.local" });
config({ path: ".env" });

const helloDocx = readFileSync(
  path.join(import.meta.dirname, "fixtures/hello.docx"),
);

function isUnavailable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("ECONNREFUSED") ||
    text.includes("does not exist") ||
    text.includes("ingest_job")
  );
}

test("uploaded job lists files, category, and unsupported errors; stays uploaded", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  try {
    const db = getDb();
    const stamp = Date.now();
    const [org] = await db
      .insert(organizations)
      .values({
        externalId: `ingest-org-${stamp}`,
        name: "Ingest org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const created = await createIngestJob({
      organizationId: org.id,
      category: "contract",
      mode: "single_type",
      files: [
        {
          filename: "hello.docx",
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: helloDocx,
        },
        {
          filename: "photo.png",
          contentType: "image/png",
          bytes: Buffer.from("not-an-image"),
        },
      ],
    });
    assert.equal(created.job.status, INGEST_JOB_UPLOADED);
    assert.equal(created.category, "contract");
    assert.equal(created.files.length, 2);
    assert.ok(created.files[0]?.extractedText);
    assert.match(created.files[1]?.error ?? "", /Unsupported/);

    const loaded = await getIngestJob({
      organizationId: org.id,
      jobId: created.job.id,
    });
    assert.equal(loaded.job.status, INGEST_JOB_UPLOADED);
    assert.equal(loaded.category, "contract");
    assert.equal(loaded.files.map((file) => file.filename).join(","), "hello.docx,photo.png");

    const invoiceFile = loaded.files[0];
    assert.ok(invoiceFile);
    await withOrganization(org.id, async (scoped) => {
      await scoped
        .update(ingestJobFiles)
        .set({
          extractedText:
            "TAX INVOICE\nBill to: Acme\nAmount due: 1200\nVAT 15%\nPlease pay this invoice.",
          error: null,
        })
        .where(eq(ingestJobFiles.id, invoiceFile.id));
    });
    const classified = await classifyIngestJob({
      organizationId: org.id,
      jobId: created.job.id,
    });
    assert.equal(classified.job.status, INGEST_JOB_CLASSIFIED);
    const invoice = classified.files.find((file) => file.id === invoiceFile.id);
    const labels = invoice?.classification as {
      inFamily?: boolean;
      holdout?: boolean;
      documentType?: string;
    } | null;
    assert.equal(labels?.documentType, "invoice");
    assert.equal(labels?.inFamily, false);
    assert.equal(labels?.holdout, true);
    assert.equal(labels?.clusterEligible, false);
    assert.equal(classified.gatesApplied, true);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    if (isUnavailable(error)) {
      t.skip("Postgres or ingest schema is not ready");
      return;
    }
    throw error;
  }
});

after(async () => {
  await closeDb();
});
