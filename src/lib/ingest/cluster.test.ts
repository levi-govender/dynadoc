import assert from "node:assert/strict";
import test from "node:test";
import type { IngestClassification } from "./classify";
import {
  mergeIngestClusters,
  proposeIngestClusters,
  stripLetterhead,
} from "./cluster";

function labels(
  documentType: string,
  extras?: Partial<IngestClassification>,
): IngestClassification {
  return {
    category: "contract",
    documentType,
    confidence: 0.9,
    rationale: "test",
    holdout: false,
    inFamily: true,
    clusterEligible: true,
    source: "heuristic",
    ...extras,
  };
}

const letterhead = "ACME CORP logo\n1 King Street letterhead\nPty Ltd\n";

test("employment vs contractor becomes two member types plus a discriminator", () => {
  const state = proposeIngestClusters([
    {
      id: "emp",
      filename: "employee.pdf",
      extractedText: `${letterhead}This employment agreement\nCompany: Acme\n2026-01-15\nNotice period four weeks.`,
      classification: labels("employment"),
    },
    {
      id: "con",
      filename: "contractor.pdf",
      extractedText: `${letterhead}Independent contractor agreement\nCompany: Acme\n2026-01-15\nNot an employee.`,
      classification: labels("contractor"),
    },
    {
      id: "hold",
      filename: "invoice.pdf",
      extractedText: "invoice",
      classification: labels("invoice", {
        holdout: true,
        clusterEligible: false,
        inFamily: false,
      }),
    },
  ]);
  assert.equal(state.published, false);
  assert.equal(state.clusters.length, 2);
  assert.equal(state.familyDraft.members.length, 2);
  assert.ok(state.discriminator);
  assert.deepEqual(
    state.discriminator?.options.map((option) => option.value).sort(),
    ["contractor", "employment"],
  );
  assert.ok(state.sharedFields.some((field) => field.id === "company"));
  assert.equal(
    state.clusters.some((cluster) => cluster.fileIds.includes("hold")),
    false,
  );
});

test("matching letterhead does not smash unlike types into one cluster", () => {
  const state = proposeIngestClusters([
    {
      id: "emp",
      filename: "a.pdf",
      extractedText: `${letterhead}employment notice period employee`,
      classification: labels("employment"),
    },
    {
      id: "lease",
      filename: "b.pdf",
      extractedText: `${letterhead}lease landlord premises`,
      classification: labels("lease"),
    },
  ]);
  assert.equal(state.clusters.length, 2);
  assert.equal(stripLetterhead(`${letterhead}body`).includes("logo"), false);
});

test("author can collapse two clusters into one branched type", () => {
  const proposed = proposeIngestClusters([
    {
      id: "emp",
      filename: "employee.pdf",
      extractedText: "employment Company: Acme 2026-01-15",
      classification: labels("employment"),
    },
    {
      id: "con",
      filename: "contractor.pdf",
      extractedText: "contractor Company: Acme 2026-01-15",
      classification: labels("contractor"),
    },
  ]);
  const merged = mergeIngestClusters(proposed, [
    proposed.clusters[0]!.id,
    proposed.clusters[1]!.id,
  ]);
  assert.equal(merged.published, false);
  assert.equal(merged.clusters.length, 1);
  assert.equal(merged.familyDraft.members.length, 1);
  const groups = merged.familyDraft.members[0]!.snapshot.formSchema.groups;
  assert.ok(groups.some((group) => group.visibleWhen?.op === "eq"));
  const branched = merged.familyDraft.members[0]!.snapshot.template.blocks.some(
    (block) => block.includeWhen?.op === "eq",
  );
  assert.equal(branched, true);
});
