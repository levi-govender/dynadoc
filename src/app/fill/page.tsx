import { AppNav } from "@/components/app-nav";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listPublishedDocumentTypes } from "@/lib/document-types/create";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FillIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }
  const membership = await requireUserMembership(session.user.id);
  try {
    assertRole(membership, INSTANCE_GENERATOR_ROLES);
  } catch (error) {
    if (error instanceof RoleForbiddenError) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>Fill is only available to operators, authors, and org admins.</p>
        </div>
      );
    }
    throw error;
  }
  const types = await listPublishedDocumentTypes(membership.organizationId);
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Fill published types</h1>
      {types.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published types yet.</p>
      ) : (
        <ul className="flex max-w-lg flex-col gap-2">
          {types.map((type) => (
            <li key={type.id}>
              <Link className="underline" href={`/fill/${type.id}`}>
                {type.name}
              </Link>
              <span className="text-muted-foreground"> ({type.slug})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
