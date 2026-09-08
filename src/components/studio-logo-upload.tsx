"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StudioLogoUpload({ documentTypeId }: { documentTypeId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex items-center gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const file = new FormData(event.currentTarget).get("file");
        if (!(file instanceof File) || file.size === 0) {
          setError("Choose a logo file");
          return;
        }
        const body = new FormData();
        body.set("file", file);
        body.set("documentTypeId", documentTypeId);
        setPending(true);
        setError(null);
        void fetch("/api/assets/logo", { method: "POST", body })
          .then(async (response) => {
            setPending(false);
            if (!response.ok) {
              const payload: unknown = await response.json().catch(() => null);
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
            router.refresh();
          });
      }}
    >
      <input accept="image/*" aria-label="Logo file" name="file" type="file" />
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        Upload logo
      </Button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </form>
  );
}
