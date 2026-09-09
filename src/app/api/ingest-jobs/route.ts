import { auth } from "@/lib/auth";
import { toAuthzResponse } from "@/lib/auth/authz";
import { requireUserMembership } from "@/lib/auth/organizations";
import { DRAFT_EDITOR_ROLES, assertRole } from "@/lib/auth/roles";
import {
  createIngestJob,
  listIngestJobs,
  serializeIngestJob,
} from "@/lib/ingest/jobs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const jobs = await listIngestJobs({
      organizationId: membership.organizationId,
    });
    return NextResponse.json({
      jobs: jobs.map((job) => {
        const payload = job.payload as { category?: string; mode?: string };
        return serializeIngestJob({
          job,
          files: [],
          category: payload.category,
          mode: payload.mode,
        });
      }),
    });
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await requireUserMembership(session.user.id);
    assertRole(membership, DRAFT_EDITOR_ROLES);
    const form = await request.formData();
    const files: Array<{
      filename: string;
      contentType: string;
      bytes: Buffer;
    }> = [];
    for (const value of form.getAll("files")) {
      if (value instanceof File) {
        files.push({
          filename: value.name,
          contentType: value.type,
          bytes: Buffer.from(await value.arrayBuffer()),
        });
      }
    }
    const created = await createIngestJob({
      organizationId: membership.organizationId,
      category: form.get("category"),
      mode: form.get("mode"),
      files,
    });
    return NextResponse.json(
      serializeIngestJob(created),
      { status: 201 },
    );
  } catch (error) {
    const response = toAuthzResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
