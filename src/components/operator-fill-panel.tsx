"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioPrintPreview } from "@/components/studio-print-preview";
import { samplePreview } from "@/lib/document-types/branching";
import { studioResolve } from "@/lib/document-types/structure-preview";
import { collectOperatorIssues } from "@/lib/document-types/answers-schema";
import { REPEATABLE_MAX_ROWS } from "@/lib/document-types/repeatable";
import type { Answers } from "@/lib/expr/evaluate";
import type { DocumentTypeVersionSnapshot, Field } from "@/types/document-type";

type Props = {
  documentTypeId: string;
  snapshot: DocumentTypeVersionSnapshot;
};

export function OperatorFillPanel({ documentTypeId, snapshot }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
              window.location.href = body.pdfDownload;
            }
          });
        }}
      >
        <h2 className="mb-1 text-sm font-medium">Answers</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Required fields must be filled before you can generate.
        </p>
        {preview.error ? (
          <p className="text-sm text-destructive">{preview.error.message}</p>
        ) : null}
        {groups.map((group) => (
          <fieldset className="mb-6 flex flex-col gap-3" key={group.id}>
            <legend className="text-sm font-medium">{group.title}</legend>
            {group.repeatable ? (
              <>
                {(Array.isArray(stripped[group.id])
                  ? (stripped[group.id] as Array<Record<string, unknown>>)
                  : []
                ).map((row, index) => (
                  <div
                    className="flex flex-col gap-3 rounded-md border p-3"
                    key={index}
                  >
                    {group.fields.map((field) => (
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
                        <FieldInput
                          field={field}
                          onChange={(value) =>
                            setRowField(group.id, index, field.id, value)
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
                      onClick={() => removeRow(group.id, index)}
                      type="button"
                      variant="outline"
                    >
                      Remove row
                    </Button>
                  </div>
                ))}
                <Button
                  disabled={
                    (Array.isArray(stripped[group.id])
                      ? stripped[group.id].length
                      : 0) >= REPEATABLE_MAX_ROWS
                  }
                  onClick={() => addRow(group.id)}
                  type="button"
                  variant="secondary"
                >
                  Add row
                </Button>
              </>
            ) : (
              group.fields.map((field) => (
                <label className="flex flex-col gap-1 text-sm" key={field.id}>
                  <span>
                    {field.label}
                    {field.required ? (
                      <span className="text-muted-foreground"> (required)</span>
                    ) : null}
                  </span>
                  <FieldInput
                    field={field}
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
        ))}
        {formIssues.map((message) => (
          <p className="text-sm text-destructive" key={message}>
            {message}
          </p>
        ))}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Generate always inserts a new instance. It does not rewrite a PDF you
          already issued.
        </p>
        <Button disabled={pending || !canGenerate} type="submit">
          Generate document
        </Button>
      </form>
      <StudioPrintPreview resolved={resolved} snapshot={snapshot} />
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const text = value == null ? "" : String(value);
  if (field.type === "select") {
    return (
      <select
        className="h-8 rounded-md border bg-background px-2"
        onChange={(event) => onChange(event.target.value || undefined)}
        value={text}
      >
        <option value="">Choose…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <input
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className="min-h-16 rounded-md border bg-background px-2 py-1"
        onChange={(event) => onChange(event.target.value)}
        value={text}
      />
    );
  }
  return (
    <Input
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? event.target.value === ""
              ? undefined
              : Number(event.target.value)
            : event.target.value,
        )
      }
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      value={text}
    />
  );
}
