"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function IngestUploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex max-w-lg flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        setPending(true);
        setError(null);
        void fetch("/api/ingest-jobs", { method: "POST", body }).then(
          async (response) => {
            const payload: unknown = await response.json().catch(() => null);
            setPending(false);
            if (!response.ok) {
              setError(
                payload &&
                  typeof payload === "object" &&
                  "error" in payload &&
                  typeof payload.error === "string"
                  ? payload.error
                  : "Upload failed",
              );
              return;
            }
            if (
              payload &&
              typeof payload === "object" &&
              "id" in payload &&
              typeof payload.id === "string"
            ) {
              router.push(`/ingest/${payload.id}`);
              router.refresh();
            }
          },
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          className="h-8 rounded-md border bg-background px-2"
          defaultValue="contract"
          name="category"
        >
          <option value="contract">Contract</option>
          <option value="policy">Policy</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ingest mode
        <select
          className="h-8 rounded-md border bg-background px-2"
          defaultValue="single_type"
          name="mode"
        >
          <option value="single_type">Single type</option>
          <option value="decompose">Decompose similar types</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Files (PDF or DOCX)
        <input
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          name="files"
          type="file"
        />
      </label>
      <Button disabled={pending} type="submit">
        {pending ? "Uploading…" : "Create ingest job"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
