"use client";

import { useEffect, useMemo, useState } from "react";
import { AnswerFieldInput } from "@/components/answer-field-input";
import { Button } from "@/components/ui/button";
import { StudioPrintPreview } from "@/components/studio-print-preview";
import { samplePreview } from "@/lib/document-types/branching";
import { studioResolve } from "@/lib/document-types/structure-preview";
import { collectOperatorIssues } from "@/lib/document-types/answers-schema";
import {
  clearFillDraft,
  readFillDraft,
  writeFillDraft,
} from "@/lib/document-types/fill-draft";
import { REPEATABLE_MAX_ROWS } from "@/lib/document-types/repeatable";
import { signatureImageFieldIds } from "@/lib/document-types/signatures";
import type { Answers } from "@/lib/expr/evaluate";
import type { DocumentTypeVersionSnapshot, Field } from "@/types/document-type";

type Props = {
  documentTypeId: string;
  snapshot: DocumentTypeVersionSnapshot;
};

export function OperatorFillPanel({ documentTypeId, snapshot }: Props) {
  const [answers, setAnswers] = useState<Answers>(
    () => readFillDraft(documentTypeId)?.answers ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(
    () => readFillDraft(documentTypeId)?.step ?? 0,
  );
  const imageFields = useMemo(
    () => signatureImageFieldIds(snapshot.styleTheme),
    [snapshot.styleTheme],
  );

  const preview = useMemo(
    () => samplePreview(snapshot.formSchema, answers),
    [answers, snapshot.formSchema],
  );
  const stripped = preview.answers;
  const resolved = studioResolve(snapshot, stripped);
  const issues = collectOperatorIssues(snapshot.formSchema, stripped);
  const issuesByField = new Map<string, string[]>();
  const formIssues: string[] = [];
  for (const issue of issues) {
    if (issue.fieldId) {
      const list = issuesByField.get(issue.fieldId) ?? [];
      list.push(issue.message);
      issuesByField.set(issue.fieldId, list);
    } else {
      formIssues.push(issue.message);
    }
  }
  const canGenerate = issues.length === 0 && !preview.error;
  const blocker = issues[0]?.message ?? preview.error?.message ?? null;

  const groups = useMemo(() => {
    const byGroup = new Map<
      string,
      { id: string; title: string; repeatable?: boolean; fields: Field[] }
    >();
    for (const entry of preview.fields) {
      const existing = byGroup.get(entry.group.id);
      if (existing) {
        existing.fields.push(entry.field);
      } else {
        byGroup.set(entry.group.id, {
          id: entry.group.id,
          title: entry.group.title,
          repeatable: entry.group.repeatable,
          fields: [entry.field],
        });
      }
    }
    return [...byGroup.values()];
  }, [preview.fields]);
  const reviewIndex = groups.length;
  const safeStep = Math.min(step, reviewIndex);
  const isReview = safeStep >= reviewIndex;
  const currentGroup = groups[safeStep];

  useEffect(() => {
    writeFillDraft(documentTypeId, { answers, step: safeStep });
  }, [answers, documentTypeId, safeStep]);

  function setRowField(
    groupId: string,
    index: number,
    fieldId: string,
    value: unknown,
  ) {
    setAnswers((current) => {
      const rows = Array.isArray(current[groupId])
        ? [...(current[groupId] as Array<Record<string, unknown>>)]
        : [];
      const row = { ...(rows[index] ?? {}) };
      if (value === undefined || value === "") {
        delete row[fieldId];
      } else {
        row[fieldId] = value;
      }
      rows[index] = row;
      return samplePreview(snapshot.formSchema, {
        ...current,
        [groupId]: rows,
      }).answers;
    });
  }

  function addRow(groupId: string) {
    setAnswers((current) => {
      const rows = Array.isArray(current[groupId])
        ? [...(current[groupId] as Array<Record<string, unknown>>)]
        : [];
      if (rows.length >= REPEATABLE_MAX_ROWS) {
        return current;
      }
      rows.push({});
      return samplePreview(snapshot.formSchema, {
        ...current,
        [groupId]: rows,
      }).answers;
    });
  }

  function removeRow(groupId: string, index: number) {
    setAnswers((current) => {
      const rows = Array.isArray(current[groupId])
        ? [...(current[groupId] as Array<Record<string, unknown>>)]
        : [];
      rows.splice(index, 1);
      return samplePreview(snapshot.formSchema, {
        ...current,
        [groupId]: rows,
      }).answers;
    });
  }

  function setField(fieldId: string, value: unknown) {
    setAnswers((current) => {
      const next = { ...current, [fieldId]: value };
      if (value === undefined || value === "") {
        delete next[fieldId];
      }
      return samplePreview(snapshot.formSchema, next).answers;
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <form
        className="flex min-h-0 flex-col overflow-y-auto border-b bg-background p-4 xl:border-r xl:border-b-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canGenerate) {
            return;
          }
          setPending(true);
          setError(null);
          void fetch(`/api/document-types/${documentTypeId}/instances`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answers: stripped }),
          }).then(async (response) => {
            const body: unknown = await response.json().catch(() => null);
            setPending(false);
            if (!response.ok) {
              setError(
                body &&
                  typeof body === "object" &&
                  "error" in body &&
                  typeof body.error === "string"
                  ? body.error
                  : "Could not generate",
              );
              return;
            }
            if (
              body &&
              typeof body === "object" &&
              "pdfDownload" in body &&
              typeof body.pdfDownload === "string"
            ) {
              const word =
                "wordDownload" in body && typeof body.wordDownload === "string"
                  ? body.wordDownload
                  : null;
              if (word) {
                const link = document.createElement("a");
                link.href = word;
                link.click();
              }
              clearFillDraft(documentTypeId);
              window.location.href = body.pdfDownload;
            }
          });
        }}
      >
        <h2 className="mb-1 text-sm font-medium">
          {isReview ? "Review" : currentGroup ? currentGroup.title : "Answers"}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {groups.length === 0
            ? "Nothing to fill on this type."
            : `Step ${safeStep + 1} of ${reviewIndex + 1}`}
        </p>
        {preview.error ? (
          <p className="text-sm text-destructive">{preview.error.message}</p>
        ) : null}
        {!isReview && currentGroup ? (
          <fieldset className="mb-6 flex flex-col gap-3">
            {currentGroup.repeatable ? (
              <>
                {(Array.isArray(stripped[currentGroup.id])
                  ? (stripped[currentGroup.id] as Array<
                      Record<string, unknown>
                    >)
                  : []
                ).map((row, index) => (
                  <div
                    className="flex flex-col gap-3 rounded-md border p-3"
                    key={index}
                  >
                    {currentGroup.fields.map((field) => (
                      <label
                        className="flex flex-col gap-1 text-sm"
                        key={field.id}
                      >
                        <span>
                          {field.label}
                          {field.required ? (
                            <span className="text-muted-foreground">
                              {" "}
                              (required)
                            </span>
                          ) : null}
                        </span>
                        <AnswerFieldInput
                          field={field}
                          image={imageFields.has(field.id)}
                          onChange={(value) =>
                            setRowField(currentGroup.id, index, field.id, value)
                          }
                          value={row[field.id]}
                        />
                        {(issuesByField.get(field.id) ?? []).map((message) => (
                          <p className="text-xs text-destructive" key={message}>
                            {message}
                          </p>
                        ))}
                      </label>
                    ))}
                    <Button
                      onClick={() => removeRow(currentGroup.id, index)}
                      type="button"
                      variant="outline"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  disabled={
                    (Array.isArray(stripped[currentGroup.id])
                      ? stripped[currentGroup.id].length
                      : 0) >= REPEATABLE_MAX_ROWS
                  }
                  onClick={() => addRow(currentGroup.id)}
                  type="button"
                  variant="secondary"
                >
                  Add {currentGroup.title.toLowerCase()}
                </Button>
              </>
            ) : (
              currentGroup.fields.map((field) => (
                <label className="flex flex-col gap-1 text-sm" key={field.id}>
                  <span>
                    {field.label}
                    {field.required ? (
                      <span className="text-muted-foreground"> (required)</span>
                    ) : null}
                  </span>
                  <AnswerFieldInput
                    field={field}
                    image={imageFields.has(field.id)}
                    onChange={(value) => setField(field.id, value)}
                    value={stripped[field.id]}
                  />
                  {(issuesByField.get(field.id) ?? []).map((message) => (
                    <p className="text-xs text-destructive" key={message}>
                      {message}
                    </p>
                  ))}
                </label>
              ))
            )}
          </fieldset>
        ) : null}
        {isReview ? (
          <ul className="mb-6 flex flex-col gap-2 text-sm">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  className="text-left font-medium text-primary hover:underline"
                  onClick={() => setStep(groups.indexOf(group))}
                  type="button"
                >
                  {group.title}
                </button>
                <p className="text-muted-foreground">
                  {group.repeatable
                    ? `${Array.isArray(stripped[group.id]) ? stripped[group.id].length : 0} row(s)`
                    : group.fields.map((field) => field.label).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {formIssues.map((message) => (
          <p className="text-sm text-destructive" key={message}>
            {message}
          </p>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!canGenerate && blocker ? (
          <p className="text-sm text-destructive">Generate is off: {blocker}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Generate creates a new issued file. It never overwrites one you
          already made.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={safeStep === 0}
            onClick={() => setStep(Math.max(0, safeStep - 1))}
            type="button"
            variant="outline"
          >
            Back
          </Button>
          {isReview ? (
            <Button disabled={pending || !canGenerate} type="submit">
              Generate document
            </Button>
          ) : (
            <Button
              onClick={() => setStep(Math.min(reviewIndex, safeStep + 1))}
              type="button"
            >
              Next
            </Button>
          )}
        </div>
      </form>
      <StudioPrintPreview resolved={resolved} snapshot={snapshot} />
    </div>
  );
}
