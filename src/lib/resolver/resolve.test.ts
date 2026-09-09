import assert from "node:assert/strict";
import test from "node:test";
import { GroupActivationCycleError, resolveDocument } from "./resolve";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

const snapshot = parseDocumentTypeVersionSnapshot(fixture);

function blockText(
  result: ReturnType<typeof resolveDocument>,
  id: string,
) {
  const block = result.document.blocks.find((entry) => entry.id === id);
  return (block?.children ?? []).map((child) => child.text).join("");
}

test("fixture: Fixed-term hides permanent clauses and shows end date", () => {
  const result = resolveDocument(snapshot, {
    employmentType: "fixed-term",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 4,
    endDate: "2027-03-31",
  });

  assert.equal(result.answers.noticeWeeks, undefined);
  assert.equal(result.answers.endDate, "2027-03-31");
  assert.equal(
    result.document.blocks.some((block) => block.id === "notice"),
    false,
  );
  assert.equal(
    blockText(result, "end"),
    "This agreement ends on 2027-03-31.",
  );
});

test("fixture: permanent keeps notice and strips end date", () => {
  const result = resolveDocument(snapshot, {
    employmentType: "permanent",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    noticeWeeks: 4,
    endDate: "2027-03-31",
  });

  assert.equal(result.answers.noticeWeeks, 4);
  assert.equal(result.answers.endDate, undefined);
  assert.equal(blockText(result, "notice"), "Notice is 4 weeks.");
  assert.equal(
    result.document.blocks.some((block) => block.id === "end"),
    false,
  );
});

test("variant map swaps job-title wording", () => {
  const engineer = resolveDocument(snapshot, {
    employmentType: "contractor",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
  });
  const manager = resolveDocument(snapshot, {
    employmentType: "contractor",
    jobTitle: "Manager",
    startDate: "2026-04-01",
  });
  assert.equal(
    blockText(engineer, "role"),
    "The employee is engaged as an engineer.",
  );
  assert.equal(
    blockText(manager, "role"),
    "The employee is engaged as a manager.",
  );
});

test("unresolved bindings stay as placeholders with warnings", () => {
  const result = resolveDocument(snapshot, {
    employmentType: "contractor",
    jobTitle: "Engineer",
  });
  assert.equal(blockText(result, "start"), "This agreement starts on {{startDate}}.");
  assert.ok(
    result.warnings.some(
      (warning) =>
        warning.field === "startDate" && warning.placeholder === "{{startDate}}",
    ),
  );
});

test("cycle in activatesGroupIds throws", () => {
  const cyclic = parseDocumentTypeVersionSnapshot({
    ...snapshot,
    formSchema: {
      schemaVersion: 1,
      groups: [
        {
          id: "a",
          title: "A",
          fields: [
            {
              id: "pickA",
              type: "select",
              label: "A",
              options: [
                {
                  value: "go",
                  label: "Go",
                  activatesGroupIds: ["b"],
                },
              ],
            },
          ],
        },
        {
          id: "b",
          title: "B",
          fields: [
            {
              id: "pickB",
              type: "select",
              label: "B",
              options: [
                {
                  value: "go",
                  label: "Go",
                  activatesGroupIds: ["a"],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.throws(
    () => resolveDocument(cyclic, { pickA: "go", pickB: "go" }),
    GroupActivationCycleError,
  );
});

test("repeatable group expands two table rows", () => {
  const withSchedule = parseDocumentTypeVersionSnapshot({
    ...snapshot,
    formSchema: {
      schemaVersion: 1,
      groups: [
        ...snapshot.formSchema.groups,
        {
          id: "schedule",
          title: "Schedule",
          repeatable: true,
          fields: [
            {
              id: "description",
              type: "text",
              label: "Item",
              required: true,
            },
          ],
        },
      ],
    },
    template: {
      schemaVersion: 1,
      blocks: [
        ...snapshot.template.blocks,
        {
          id: "schedule-table",
          type: "table",
          children: [{ type: "bind", field: "schedule[].description" }],
        },
      ],
    },
  });
  const result = resolveDocument(withSchedule, {
    employmentType: "contractor",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    schedule: [{ description: "Kickoff" }, { description: "Handover" }],
  });
  const table = result.document.blocks.find(
    (block) => block.id === "schedule-table",
  );
  assert.equal(table?.rows?.length, 2);
  assert.equal(table?.rows?.[0]?.[0]?.text, "Kickoff");
  assert.equal(table?.rows?.[1]?.[0]?.text, "Handover");
});

test("repeatable missing bindings warn once, not once per empty row", () => {
  const withSchedule = parseDocumentTypeVersionSnapshot({
    ...snapshot,
    formSchema: {
      schemaVersion: 1,
      groups: [
        ...snapshot.formSchema.groups,
        {
          id: "schedule",
          title: "Schedule",
          repeatable: true,
          fields: [
            {
              id: "description",
              type: "text",
              label: "Item",
            },
          ],
        },
      ],
    },
    template: {
      schemaVersion: 1,
      blocks: [
        {
          id: "schedule-table",
          type: "table",
          children: [{ type: "bind", field: "schedule[].description" }],
        },
      ],
    },
  });
  const result = resolveDocument(withSchedule, {
    employmentType: "contractor",
    jobTitle: "Engineer",
    startDate: "2026-04-01",
    schedule: [{}, {}],
  });
  const missing = result.warnings.filter(
    (warning) => warning.field === "schedule[].description",
  );
  assert.equal(missing.length, 1);
});
