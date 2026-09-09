"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SampleAnswersPanel } from "@/components/sample-answers-panel";
import { StudioBlockCanvas } from "@/components/studio-block-canvas";
import { StudioControlPanel } from "@/components/studio-control-panel";
import { StudioPrintPreview } from "@/components/studio-print-preview";
import { StudioStructurePreview } from "@/components/studio-structure-preview";
import {
  overlappingActivationWarnings,
  samplePreview,
} from "@/lib/document-types/branching";
import { studioResolve } from "@/lib/document-types/structure-preview";
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
  const [pane, setPane] = useState<"structure" | "print">("structure");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [draftPdfPending, setDraftPdfPending] = useState(false);
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
  const resolved = studioResolve(snapshot, preview.answers);

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
      {pane === "print" ? (
        <StudioPrintPreview
          draftWatermark
          resolved={resolved}
          snapshot={snapshot}
        />
      ) : (
        <StudioBlockCanvas
          onChange={patchTemplate}
          resolved={resolved}
          selectedFieldId={selectedFieldId}
          snapshot={snapshot}
        />
      )}
      <div className="min-h-0 overflow-y-auto border-t bg-background p-4 xl:border-t-0 xl:border-l">
        <div className="mb-4 flex gap-1">
          <Button
            onClick={() => setPane("structure")}
            size="xs"
            type="button"
            variant={pane === "structure" ? "secondary" : "outline"}
          >
            Structure
          </Button>
          <Button
            onClick={() => setPane("print")}
            size="xs"
            type="button"
            variant={pane === "print" ? "secondary" : "outline"}
          >
            Print preview
          </Button>
        </div>
        {pane === "print" ? (
          <Button
            className="mb-4"
            disabled={draftPdfPending || Boolean(preview.error)}
            onClick={() => {
              setDraftPdfPending(true);
              setError(null);
              void fetch(`/api/document-types/${documentTypeId}/instances`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  answers: preview.answers,
                  fromDraft: true,
                }),
              }).then(async (response) => {
                const body: unknown = await response.json().catch(() => null);
                setDraftPdfPending(false);
                if (!response.ok) {
                  const message =
                    body &&
                    typeof body === "object" &&
                    "error" in body &&
                    typeof body.error === "string"
                      ? body.error
                      : "Could not generate draft PDF";
                  setError(message);
                  return;
                }
                if (
                  body &&
                  typeof body === "object" &&
                  "pdfBase64" in body &&
                  typeof body.pdfBase64 === "string" &&
                  "filename" in body &&
                  typeof body.filename === "string"
                ) {
                  const bytes = Uint8Array.from(atob(body.pdfBase64), (char) =>
                    char.charCodeAt(0),
                  );
                  const url = URL.createObjectURL(
                    new Blob([bytes], { type: "application/pdf" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = body.filename;
                  link.click();
                  URL.revokeObjectURL(url);
                }
              });
            }}
            size="sm"
            type="button"
          >
            {draftPdfPending ? "Generating…" : "Download draft PDF"}
          </Button>
        ) : null}
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
        {pane === "structure" ? (
          <StudioStructurePreview resolved={resolved} />
        ) : null}
      </div>
    </div>
  );
}
