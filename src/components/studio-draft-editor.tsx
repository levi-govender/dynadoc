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
import { StudioPublishButton } from "@/components/studio-publish-button";
import { snapshotUsesAdvancedRules } from "@/lib/document-types/studio-mode";
import { signatureImageFieldIds } from "@/lib/document-types/signatures";
import type { Answers } from "@/lib/expr/evaluate";
import type {
  DocumentTypeVersionSnapshot,
  FormSchema,
  Template,
} from "@/types/document-type";

type Props = {
  documentTypeId: string;
  initialSnapshot: DocumentTypeVersionSnapshot;
  typeStatus: string;
  publishedVersionId: string | null;
};

export function StudioDraftEditor({
  documentTypeId,
  initialSnapshot,
  typeStatus,
  publishedVersionId,
}: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [simple, setSimple] = useState(
    () => !snapshotUsesAdvancedRules(initialSnapshot),
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [sampleAnswers, setSampleAnswers] = useState<Answers>({});
  const [pane, setPane] = useState<"structure" | "print">("structure");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [draftPdfPending, setDraftPdfPending] = useState(false);
  const skipFirst = useRef(true);
  const undoStack = useRef<DocumentTypeVersionSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  function pushUndo(previous: DocumentTypeVersionSnapshot) {
    undoStack.current.push(structuredClone(previous));
    if (undoStack.current.length > 40) {
      undoStack.current.shift();
    }
    setCanUndo(true);
  }

  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) {
      return;
    }
    setCanUndo(undoStack.current.length > 0);
    setSnapshot(previous);
  }

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

  const undoFn = useRef(undo);
  undoFn.current = undo;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "z"
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (!undoStack.current.length) {
        return;
      }
      event.preventDefault();
      undoFn.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const form = snapshot.formSchema;
  const overlapWarnings = overlappingActivationWarnings(form);
  const preview = samplePreview(form, sampleAnswers);
  const resolved = studioResolve(snapshot, preview.answers);

  function patchForm(next: FormSchema | ((current: FormSchema) => FormSchema)) {
    const formSchema = typeof next === "function" ? next(form) : next;
    pushUndo(snapshot);
    setSnapshot((current) => ({ ...current, formSchema }));
    setSampleAnswers((previous) => {
      const stripped = samplePreview(formSchema, previous).answers;
      return JSON.stringify(stripped) === JSON.stringify(previous)
        ? previous
        : stripped;
    });
  }

  function patchTemplate(next: (current: Template) => Template) {
    pushUndo(snapshot);
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
        simple={simple}
        onUndo={undo}
        canUndo={canUndo}
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
          simple={simple}
          snapshot={snapshot}
        />
      )}
      <div className="min-h-0 overflow-y-auto border-t bg-background p-4 xl:border-t-0 xl:border-l">
        <div className="mb-4 flex flex-wrap items-center gap-1">
          <Button
            onClick={() => setSimple(true)}
            size="xs"
            type="button"
            variant={simple ? "secondary" : "outline"}
          >
            Simple
          </Button>
          <Button
            onClick={() => setSimple(false)}
            size="xs"
            type="button"
            variant={simple ? "outline" : "secondary"}
          >
            Advanced
          </Button>
          <Button
            onClick={() => setPane("structure")}
            size="xs"
            type="button"
            variant={pane === "structure" ? "secondary" : "outline"}
          >
            {simple ? "Outline" : "Structure"}
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
        <div className="mb-4">
          <StudioPublishButton documentTypeId={documentTypeId} />
          <p className="mt-1 text-xs text-muted-foreground">
            {typeStatus === "published"
              ? "Operators can fill the last published version."
              : "Publish when this type is ready to fill."}
          </p>
        </div>
        {simple ? null : (
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <a
              className="font-medium text-primary hover:underline"
              href={`/api/document-types/${documentTypeId}/export?source=draft`}
            >
              Export draft JSON
            </a>
            {publishedVersionId ? (
              <a
                className="font-medium text-primary hover:underline"
                href={`/api/document-types/${documentTypeId}/export?source=published`}
              >
                Export published JSON
              </a>
            ) : null}
          </div>
        )}
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
          imageFieldIds={signatureImageFieldIds(snapshot.styleTheme)}
          groups={(() => {
            const byGroup = new Map<
              string,
              {
                id: string;
                title: string;
                repeatable?: boolean;
                fields: (typeof preview.fields)[number]["field"][];
              }
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
          })()}
          onChange={(next) => {
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
