"use client";

import { useEffect, useRef, useState } from "react";
import { SampleAnswersPanel } from "@/components/sample-answers-panel";
import { StudioBlockCanvas } from "@/components/studio-block-canvas";
import { StudioControlPanel } from "@/components/studio-control-panel";
import {
  overlappingActivationWarnings,
  samplePreview,
} from "@/lib/document-types/branching";
import type { Answers } from "@/lib/expr/evaluate";
import type {
  DocumentTypeVersionSnapshot,
  FormSchema,
  Template,
} from "@/types/document-type";

type Props = {
  documentTypeId: string;
  initialSnapshot: DocumentTypeVersionSnapshot;
};

export function StudioDraftEditor({ documentTypeId, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [sampleAnswers, setSampleAnswers] = useState<Answers>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setStatus("saving");
        const response = await fetch(
          `/api/document-types/${documentTypeId}/draft`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(snapshot),
          },
        );
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const message =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Could not save draft";
          setError(message);
          setStatus("error");
          return;
        }
        setError(null);
        setStatus("saved");
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [documentTypeId, snapshot]);

  const form = snapshot.formSchema;
  const overlapWarnings = overlappingActivationWarnings(form);
  const preview = samplePreview(form, sampleAnswers);

  function patchForm(next: FormSchema | ((current: FormSchema) => FormSchema)) {
    const formSchema = typeof next === "function" ? next(form) : next;
    setSnapshot((current) => ({ ...current, formSchema }));
    setSampleAnswers((previous) => {
      const stripped = samplePreview(formSchema, previous).answers;
      return JSON.stringify(stripped) === JSON.stringify(previous)
        ? previous
        : stripped;
    });
  }

  function patchTemplate(next: (current: Template) => Template) {
    setSnapshot((current) => ({
      ...current,
      template: next(current.template),
    }));
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(16rem,19rem)]">
      <StudioControlPanel
        error={error}
        form={form}
        onSelectField={setSelectedFieldId}
        overlapWarnings={overlapWarnings}
        patchForm={patchForm}
        selectedFieldId={selectedFieldId}
        status={status}
      />
      <StudioBlockCanvas
        onChange={patchTemplate}
        selectedFieldId={selectedFieldId}
        template={snapshot.template}
      />
      <div className="min-h-0 overflow-y-auto border-t bg-background p-4 xl:border-t-0 xl:border-l">
        <SampleAnswersPanel
          answers={preview.answers}
          error={preview.error?.message ?? null}
          fields={preview.fields.map((entry) => ({
            field: entry.field,
            groupTitle: entry.group.title,
          }))}
          onChange={(fieldId, value) => {
            const next = { ...sampleAnswers };
            if (value === undefined || value === "") {
              delete next[fieldId];
            } else {
              next[fieldId] = value;
            }
            setSampleAnswers(samplePreview(form, next).answers);
          }}
        />
      </div>
    </div>
  );
}
