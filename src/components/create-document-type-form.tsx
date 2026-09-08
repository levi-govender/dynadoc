"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugFromName } from "@/lib/document-types/defaults";

export function CreateDocumentTypeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const derivedSlug = useMemo(() => slugFromName(name), [name]);
  const slugValue = slugTouched ? slug : derivedSlug;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/document-types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug: slugValue }),
    });
    const payload: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "Could not create document type";
      setError(message);
      return;
    }
    if (
      payload &&
      typeof payload === "object" &&
      "id" in payload &&
      typeof payload.id === "string"
    ) {
      router.push(`/studio/${payload.id}`);
      router.refresh();
      return;
    }
    setError("Could not open the new draft");
  }

  return (
    <form className="flex max-w-lg flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
      <Input
        aria-label="Document type name"
        onChange={(event) => setName(event.target.value)}
        placeholder="Employment contract"
        value={name}
      />
      <Input
        aria-label="Slug"
        onChange={(event) => {
          setSlugTouched(true);
          setSlug(event.target.value);
        }}
        placeholder="employment-contract"
        value={slugValue}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={pending || !name.trim() || !slugValue} type="submit">
        Create draft
      </Button>
    </form>
  );
}
