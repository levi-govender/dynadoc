"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import exampleEngagement from "@/types/fixtures/complex-engagement.export.json";

export function ImportDocumentTypeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function importPayload(payload: unknown) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/document-types/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "Import failed";
      setError(message);
      return;
    }
    if (
      body &&
      typeof body === "object" &&
      "types" in body &&
      Array.isArray(body.types) &&
      body.types[0] &&
      typeof body.types[0] === "object" &&
      body.types[0] !== null &&
      "id" in body.types[0] &&
      typeof body.types[0].id === "string"
    ) {
      router.push(`/studio/${body.types[0].id}`);
      router.refresh();
      return;
    }
    setError("Import did not return a draft");
  }

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          setError("Choose a JSON file");
          return;
        }
        void file.text().then((text) => {
          try {
            void importPayload(JSON.parse(text) as unknown);
          } catch {
            setError("Invalid JSON");
          }
        });
      }}
    >
      <input
        accept="application/json,.json"
        aria-label="Import JSON"
        name="file"
        type="file"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={pending} type="submit">
        Import JSON
      </Button>
      <Button
        disabled={pending}
        onClick={() => {
          void importPayload(exampleEngagement);
        }}
        type="button"
        variant="outline"
      >
        Open example engagement
      </Button>
    </form>
  );
}
