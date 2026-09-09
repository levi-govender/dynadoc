"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function IngestClassifyButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void fetch(`/api/ingest-jobs/${jobId}/classify`, {
            method: "POST",
          }).then(async (response) => {
            setPending(false);
            if (!response.ok) {
              const body: unknown = await response.json().catch(() => null);
              setError(
                body &&
                  typeof body === "object" &&
                  "error" in body &&
                  typeof body.error === "string"
                  ? body.error
                  : "Classify failed",
              );
              return;
            }
            router.refresh();
          });
        }}
        type="button"
      >
        {pending ? "Classifying…" : "Classify files"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
