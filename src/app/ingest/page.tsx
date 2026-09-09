import { AppNav } from "@/components/app-nav";
import { IngestUploadForm } from "@/components/ingest-upload-form";
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
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Ingest is only available to authors and org admins.</p>
        </div>
      );
    }
    throw error;
  }
  const jobs = await listIngestJobs({
    organizationId: membership.organizationId,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Corpus ingest</h1>
      <p className="text-sm text-muted-foreground">
        Upload PDFs or DOCX, declare the expected category and mode. Jobs stay
        uploaded until classify. Clustering does not run yet.
      </p>
      <IngestUploadForm />
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingest jobs yet.</p>
      ) : (
        <ul className="flex max-w-lg flex-col gap-2 text-sm">
          {jobs.map((job) => {
            const payload = job.payload as { category?: string; mode?: string };
            return (
              <li key={job.id}>
                <Link className="underline" href={`/ingest/${job.id}`}>
                  {payload.category ?? "job"} · {job.status}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
