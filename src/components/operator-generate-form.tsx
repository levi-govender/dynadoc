"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OperatorGenerateForm({ documentTypeId }: { documentTypeId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [answers, setAnswers] = useState("{}");

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(answers) as unknown;
        } catch {
          setError("Answers must be JSON");
          return;
        }
        setPending(true);
        setError(null);
        void fetch(`/api/document-types/${documentTypeId}/instances`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: parsed }),
        }).then(async (response) => {
          const payload: unknown = await response.json().catch(() => null);
          setPending(false);
          if (!response.ok) {
            setError(
              payload &&
                typeof payload === "object" &&
                "error" in payload &&
                typeof payload.error === "string"
                ? payload.error
                : "Could not generate",
            );
            return;
          }
          if (
            payload &&
            typeof payload === "object" &&
            "pdfDownload" in payload &&
            typeof payload.pdfDownload === "string"
          ) {
            window.location.href = payload.pdfDownload;
          }
        });
      }}
    >
      <textarea
        aria-label="Answers JSON"
        className="min-h-32 rounded-md border px-3 py-2 font-mono text-sm"
        onChange={(event) => setAnswers(event.target.value)}
        value={answers}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={pending} type="submit">
        Generate PDF
      </Button>
    </form>
  );
}
