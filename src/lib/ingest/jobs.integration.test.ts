import assert from "node:assert/strict";
import { after } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { createIngestJob, getIngestJob } from "./jobs";
import { INGEST_JOB_UPLOADED } from "./extract";

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
