import { AppNav } from "@/components/app-nav";
import { CreateDocumentTypeForm } from "@/components/create-document-type-form";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  DRAFT_EDITOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listDocumentTypes } from "@/lib/document-types/create";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
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
          <p>Author Studio is only available to authors and org admins.</p>
        </div>
      );
    }
    throw error;
  }

  const types = await listDocumentTypes(membership.organizationId);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Author Studio</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">New document type</h2>
        <CreateDocumentTypeForm />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Types in this organization</h2>
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">No document types yet.</p>
        ) : (
          <ul className="flex max-w-lg flex-col gap-2">
            {types.map((type) => (
              <li key={type.id}>
                <Link className="underline" href={`/studio/${type.id}`}>
                  {type.name}
                </Link>
                <span className="text-muted-foreground"> ({type.slug})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
