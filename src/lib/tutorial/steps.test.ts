import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTORIAL_STEPS,
  canAdvanceTutorial,
  emptyTutorialProgress,
  type TutorialProgress,
} from "./steps";

test("tutorial covers each product surface in one-sentence steps", () => {
  assert.equal(TUTORIAL_STEPS.length, 17);
  assert.ok(TUTORIAL_STEPS.every((step) => !step.explanation.includes("\n")));
  const ids = TUTORIAL_STEPS.map((step) => step.id).join(" ");
  assert.match(
    ids,
    /welcome roles org studio fields branching tree template publish fill issue exports esign ingest holdout inbox done/,
  );
});

test("guided steps stay blocked until the practice input is complete", () => {
  const blank = emptyTutorialProgress();
  assert.equal(canAdvanceTutorial("welcome", blank), true);
  assert.equal(canAdvanceTutorial("roles", blank), false);
  assert.equal(canAdvanceTutorial("org", blank), false);
  assert.equal(canAdvanceTutorial("done", blank), true);

  const ready: TutorialProgress = {
    ...blank,
    role: "author",
    inviteEmail: "alex@example.com",
    typeName: "Employment contract",
    fieldLabel: "Employee name",
    employmentType: "permanent",
    examplePath: "contractor",
    clause: "This agreement is between",
    bindingInserted: true,
    published: true,
    employeeName: "Ada Lovelace",
    generated: true,
    downloadedPdf: true,
    downloadedDocx: true,
    signerEmail: "ada@example.com",
    esignSent: true,
    sampleFile: "invoice.pdf",
    holdoutAction: "recategorize",
    rereviewAck: true,
  };

  for (const step of TUTORIAL_STEPS) {
    assert.equal(canAdvanceTutorial(step.id, ready), true, step.id);
  }
});
