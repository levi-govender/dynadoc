import { AppChrome } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { IngestClassifyButton } from "@/components/ingest-classify-button";
import { IngestClusterPanel } from "@/components/ingest-cluster-panel";
import { IngestStyleThemePanel } from "@/components/ingest-style-theme-panel";
import { getIngestJob, IngestJobNotFoundError } from "@/lib/ingest/jobs";
import {
  INGEST_JOB_CLASSIFIED,
  INGEST_JOB_CLUSTERED,
  INGEST_JOB_UPLOADED,
} from "@/lib/ingest/extract";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IngestJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, DRAFT_EDITOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Ingest is only available to authors and org admins.
          </p>
        </AppChrome>
      );
    }
    throw error;
  }
  const { id } = await params;
  let loaded;
  try {
    loaded = await getIngestJob({
      organizationId: membership.organizationId,
      jobId: id,
    });
  } catch (error) {
    if (error instanceof IngestJobNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Ingest job
      </h1>
      <p className="text-sm">
        Category: <strong>{loaded.category}</strong>
        {" · "}
        Mode: <strong>{loaded.mode}</strong>
        {" · "}
        Status: <strong>{loaded.job.status}</strong>
        {loaded.gatesApplied ? " · gates applied" : ""}
      </p>
      <p className="text-sm text-muted-foreground">
        Held-out files skip clause clustering. Merge or split remaining files
        only after gates pass on the cluster-eligible set. Inbox lists holdout
        notifications.
      </p>
      {loaded.job.status === INGEST_JOB_UPLOADED ? (
        <IngestClassifyButton jobId={loaded.job.id} />
      ) : null}
      {loaded.job.status === INGEST_JOB_CLASSIFIED ||
      loaded.job.status === INGEST_JOB_CLUSTERED ? (
        <IngestClusterPanel
          canCluster={loaded.gatesApplied}
          clusterState={loaded.clusterState}
          jobId={loaded.job.id}
          savedDrafts={loaded.savedDrafts}
        />
      ) : null}
      {loaded.job.status === INGEST_JOB_CLUSTERED ? (
        <IngestStyleThemePanel
          drafts={loaded.savedDrafts?.types ?? []}
          jobId={loaded.job.id}
        />
      ) : null}
      <ul className="flex max-w-xl flex-col gap-2 text-sm">
        {loaded.files.map((file) => {
          const classification = file.classification as {
            documentType?: string;
            category?: string;
            confidence?: number;
            holdout?: boolean;
            inFamily?: boolean;
            clusterEligible?: boolean;
            gateReason?: string;
            rationale?: string;
          } | null;
          return (
            <li className="rounded-md border p-3" key={file.id}>
              <p className="font-medium">{file.filename}</p>
              {file.error ? (
                <p className="text-destructive">{file.error}</p>
              ) : (
                <p className="text-muted-foreground">
                  Text extracted
                  {file.extractedText
                    ? ` (${file.extractedText.trim().length} characters)`
                    : ""}
                </p>
              )}
              {classification ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {classification.documentType} · {classification.category} ·
                  confidence{" "}
                  {Math.round((classification.confidence ?? 0) * 100)}%
                  {classification.holdout ? " · holdout" : ""}
                  {classification.inFamily
                    ? " · in-family"
                    : " · not in-family"}
                  {classification.clusterEligible
                    ? " · cluster-eligible"
                    : " · not for clustering"}
                  {classification.gateReason
                    ? ` · gate ${classification.gateReason}`
                    : ""}
                  {classification.rationale
                    ? ` — ${classification.rationale}`
                    : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </AppChrome>
  );
}
