"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StudioPublishButton({
  documentTypeId,
}: {
  documentTypeId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Publish this version for operators to fill? Later draft edits will not change issued documents.",
            )
          ) {
            return;
          }
          setPending(true);
          setError(null);
          void fetch(`/api/document-types/${documentTypeId}/publish`, {
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
                  : "Could not publish",
              );
              return;
            }
            router.refresh();
          });
        }}
        size="sm"
        type="button"
      >
        {pending ? "Publishing…" : "Publish for operators"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
