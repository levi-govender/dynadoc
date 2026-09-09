import { AppNav } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { getIngestJob, IngestJobNotFoundError } from "@/lib/ingest/jobs";
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
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Ingest is only available to authors and org admins.</p>
        </div>
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
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Ingest job</h1>
      <p className="text-sm">
        Category: <strong>{loaded.category}</strong>
        {" · "}
        Mode: <strong>{loaded.mode}</strong>
        {" · "}
        Status: <strong>{loaded.job.status}</strong>
      </p>
      <ul className="flex max-w-xl flex-col gap-2 text-sm">
        {loaded.files.map((file) => (
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
          </li>
        ))}
      </ul>
    </div>
  );
}
