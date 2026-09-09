import { AppChrome } from "@/components/app-nav";
import { IngestUploadForm } from "@/components/ingest-upload-form";
import { EmptyState, PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listIngestJobs } from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IngestIndexPage() {
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
  const jobs = await listIngestJobs({
    organizationId: membership.organizationId,
  });

  return (
    <AppChrome email={session.user.email} role={membership.role}>
      <PageHeader
        description="Upload samples, classify, then group into draft types. Nothing goes live until you publish in Studio."
        title="Ingest"
      />
      <Card>
        <CardHeader>
          <CardTitle>New job</CardTitle>
          <CardDescription>
            PDF or Word. Classify after upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IngestUploadForm />
        </CardContent>
      </Card>
      {jobs.length === 0 ? (
        <EmptyState
          description="Start with a small set of the same document category."
          title="No ingest jobs yet"
        />
      ) : (
        <ul className="grid gap-2">
          {jobs.map((job) => {
            const payload = job.payload as { category?: string; mode?: string };
            return (
              <li key={job.id}>
                <Link
                  className="flex items-center justify-between rounded-md border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                  href={`/ingest/${job.id}`}
                >
                  <span className="font-medium capitalize">
                    {payload.category ?? "job"}
                    {payload.mode ? ` · ${payload.mode}` : ""}
                  </span>
                  <span className="capitalize text-muted-foreground">
                    {job.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppChrome>
  );
}
