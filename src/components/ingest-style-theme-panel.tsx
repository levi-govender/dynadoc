"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { printPreviewPageCss } from "@/lib/document-types/print-preview";
import type { LayoutHints } from "@/lib/ingest/style-theme";
import type { StyleTheme } from "@/types/document-type";

type Proposal = {
  hints: LayoutHints;
  proposal: StyleTheme;
  sampleCount: number;
};

export function IngestStyleThemePanel({
  jobId,
  drafts,
}: {
  jobId: string;
  drafts: Array<{ id: string; slug: string; status: string }>;
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState<string[]>([]);

  useEffect(() => {
    void fetch(`/api/ingest-jobs/${jobId}/style-theme`).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
            ? body.error
            : "Could not propose a style theme",
        );
        return;
      }
      setProposal(body as Proposal);
    });
  }, [jobId]);

  const css = proposal ? printPreviewPageCss(proposal.proposal) : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <h3 className="text-sm font-medium">Style theme proposal</h3>
      <p className="text-xs text-muted-foreground">
        Same design family as the default professional theme, not a pixel
        clone. Logo stays a placeholder until you upload one. Accepting writes
        draft style_theme only.
      </p>
      {proposal ? (
        <>
          <p className="text-xs text-muted-foreground">
            Source sample ({proposal.sampleCount} files):{" "}
            {proposal.hints.sampleExcerpt || "—"}
          </p>
          <p className="text-sm">
            Proposed {proposal.proposal.page.size},{" "}
            {proposal.proposal.typography.body.family}{" "}
            {proposal.proposal.typography.body.size}pt, logo{" "}
            {proposal.hints.logoPosition}, footer{" "}
            {proposal.proposal.letterhead.footerMode}.
          </p>
          {css ? (
            <article
              className="bg-white text-zinc-900 shadow-sm"
              style={{
                width: "min(100%, 12rem)",
                minHeight: "8rem",
                padding: "0.5rem",
                fontFamily: css.fontFamily,
                fontSize: "10px",
              }}
            >
              Print preview family
            </article>
          ) : null}
          {drafts.map((type) => (
            <div className="flex items-center gap-2" key={type.id}>
              <Button
                disabled={pending || accepted.includes(type.id)}
                onClick={() => {
                  setPending(true);
                  setError(null);
                  void fetch(`/api/ingest-jobs/${jobId}/style-theme`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ documentTypeId: type.id }),
                  }).then(async (response) => {
                    setPending(false);
                    const body: unknown = await response.json().catch(() => null);
                    if (!response.ok) {
                      setError(
                        body &&
                          typeof body === "object" &&
                          "error" in body &&
                          typeof body.error === "string"
                          ? body.error
                          : "Could not accept proposal",
                      );
                      return;
                    }
                    setAccepted((current) => [...current, type.id]);
                  });
                }}
                size="xs"
                type="button"
              >
                {accepted.includes(type.id)
                  ? `Accepted on ${type.slug}`
                  : `Accept onto ${type.slug} draft`}
              </Button>
              <span className="text-xs text-muted-foreground">{type.status}</span>
            </div>
          ))}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Loading proposal…</p>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
