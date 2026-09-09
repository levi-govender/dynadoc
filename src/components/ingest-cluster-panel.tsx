"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IngestClusterState } from "@/lib/ingest/cluster";
import { diffAgainstEmptyDraft } from "@/lib/ingest/review";

function readError(body: unknown, fallback: string) {
  return body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : fallback;
}

export function IngestClusterPanel({
  jobId,
  canCluster,
  clusterState,
  savedDrafts,
}: {
  jobId: string;
  canCluster: boolean;
  clusterState: IngestClusterState | null;
  savedDrafts: {
    familyId: string;
    types: Array<{ id: string; slug: string; status: string }>;
  } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  function run(path: string, body?: unknown) {
    setPending(true);
    setError(null);
    void fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (response) => {
      setPending(false);
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setError(readError(payload, "Cluster request failed"));
        return;
      }
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {canCluster ? (
        <Button
          disabled={pending}
          onClick={() => run(`/api/ingest-jobs/${jobId}/cluster`)}
          type="button"
        >
          {pending ? "Grouping…" : "Group matching files"}
        </Button>
      ) : null}
      {clusterState ? (
        <>
          <p className="text-sm">
            Draft family only — never published. Discriminator:{" "}
            <strong>
              {clusterState.discriminator?.label ?? "none (single type)"}
            </strong>
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {clusterState.clusters.map((cluster) => (
              <li className="rounded-md border p-3" key={cluster.id}>
                <label className="flex items-center gap-2">
                  <input
                    checked={selected.includes(cluster.id)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, cluster.id]
                          : current.filter((id) => id !== cluster.id),
                      );
                    }}
                    type="checkbox"
                  />
                  {cluster.documentTypes.join(" + ")} ({cluster.fileIds.length}{" "}
                  files)
                </label>
                {cluster.documentTypes.length > 1 ? (
                  <Button
                    className="mt-2"
                    disabled={pending}
                    onClick={() =>
                      run(`/api/ingest-jobs/${jobId}/clusters`, {
                        action: "split",
                        clusterId: cluster.id,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Split cluster
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button
            disabled={pending || selected.length !== 2}
            onClick={() =>
              run(`/api/ingest-jobs/${jobId}/clusters`, {
                action: "merge",
                clusterIds: selected,
              })
            }
            type="button"
            variant="outline"
          >
            Collapse selected into one branched type
          </Button>
          <p className="text-xs text-muted-foreground">
            Members:{" "}
            {clusterState.familyDraft.members.map((member) => member.name).join(", ")}
            {clusterState.sharedFields.length
              ? ` · shared ${clusterState.sharedFields.map((field) => field.label).join(", ")}`
              : ""}
          </p>
          <ul className="flex flex-col gap-3 text-sm">
            {clusterState.familyDraft.members.map((member) => {
              const diff = diffAgainstEmptyDraft(member.snapshot);
              return (
                <li className="rounded-md border p-3" key={member.slug}>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Diff vs empty draft — accept or reject added clauses
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {diff.map((row) => (
                      <li key={row.id}>
                        <label className="flex items-start gap-2">
                          <input
                            checked={rejected.includes(row.id)}
                            onChange={(event) => {
                              setRejected((current) =>
                                event.target.checked
                                  ? [...current, row.id]
                                  : current.filter((id) => id !== row.id),
                              );
                            }}
                            type="checkbox"
                          />
                          <span>
                            <span className="text-xs uppercase text-muted-foreground">
                              {row.vsEmpty}
                            </span>
                            {" — "}
                            {row.vsEmpty === "added" ? "Reject added: " : ""}
                            {row.text.slice(0, 160) || row.type}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {clusterState.discriminator ? (
            <p className="text-sm">
              Discriminator field: {clusterState.discriminator.id} (
              {clusterState.discriminator.options
                .map((option) => option.value)
                .join(", ")}
              )
            </p>
          ) : null}
          {clusterState.sharedFields.length ? (
            <p className="text-sm">
              Shared fields:{" "}
              {clusterState.sharedFields
                .map((field) => field.label)
                .join(", ")}
            </p>
          ) : null}
          {savedDrafts ? (
            <p className="text-sm">
              Saved draft types:{" "}
              {savedDrafts.types
                .map((type) => `${type.slug} (${type.status})`)
                .join(", ")}
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                  type="checkbox"
                />
                I reviewed this draft tree. Do not publish.
              </label>
              <Button
                disabled={pending || !reviewed}
                onClick={() =>
                  run(`/api/ingest-jobs/${jobId}/drafts`, {
                    confirmed: true,
                    rejectedBlockIds: rejected,
                  })
                }
                type="button"
              >
                Save as draft types
              </Button>
            </>
          )}
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
