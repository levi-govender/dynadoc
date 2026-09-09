"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductTutorial } from "@/components/product-tutorial";
import exampleEngagement from "@/types/fixtures/complex-engagement.export.json";

export function HomeFirstRun({
  showAuthorStart,
}: {
  showAuthorStart: boolean;
}) {
  const router = useRouter();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Get started</p>
      <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
        {showAuthorStart ? (
          <>
            <button
              className="bg-background px-4 py-5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
              disabled={pending}
              onClick={() => {
                setPending(true);
                setError(null);
                void fetch("/api/document-types/import", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(exampleEngagement),
                }).then(async (response) => {
                  const body: unknown = await response.json().catch(() => null);
                  setPending(false);
                  if (!response.ok) {
                    setError(
                      body &&
                        typeof body === "object" &&
                        "error" in body &&
                        typeof body.error === "string"
                        ? body.error
                        : "Could not open the example",
                    );
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
                  }
                });
              }}
              type="button"
            >
              <p className="text-sm font-medium">
                {pending ? "Opening example…" : "Open the example"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Load a branched engagement type you can edit and publish.
              </p>
            </button>
            <Link
              className="bg-background px-4 py-5 transition-colors hover:bg-muted/60"
              href="/studio"
            >
              <p className="text-sm font-medium">Start blank</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an empty type in Studio.
              </p>
            </Link>
            <Link
              className="bg-background px-4 py-5 transition-colors hover:bg-muted/60"
              href="/ingest"
            >
              <p className="text-sm font-medium">Ingest samples</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload PDF or Word files to draft types from a corpus.
              </p>
            </Link>
          </>
        ) : null}
        <button
          className="bg-background px-4 py-5 text-left transition-colors hover:bg-muted/60"
          onClick={() => setTutorialOpen(true)}
          type="button"
        >
          <p className="text-sm font-medium">Tutorial</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A short walkthrough of authoring, fill, ingest, and issue.
          </p>
        </button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ProductTutorial onOpenChange={setTutorialOpen} open={tutorialOpen} />
    </div>
  );
}
