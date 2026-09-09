import { IssuedDocumentCard } from "@/components/issued-document-card";
import { AppChrome } from "@/components/app-nav";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { requireUserMembership } from "@/lib/auth/organizations";
import {
  INSTANCE_GENERATOR_ROLES,
  RoleForbiddenError,
  assertRole,
} from "@/lib/auth/roles";
import { listDocumentTypes } from "@/lib/document-types/create";
import {
  listInstances,
  parseInstanceListQuery,
} from "@/lib/document-types/instances";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InstanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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
        <AppChrome email={session.user.email} role={membership.role}>
          <p className="text-sm text-muted-foreground">
            Issued documents are only available to operators, authors, and org
            admins.
          </p>
        </AppChrome>
      );
    }
    throw error;
  }
  const params = await searchParams;
  const query = parseInstanceListQuery(params);
  const [types, rows] = await Promise.all([
    listDocumentTypes(membership.organizationId),
    listInstances({
      organizationId: membership.organizationId,
      ...query,
    }),
  ]);

  return (
    <AppChrome email={session.user.email} role={membership.role} wide>
      <PageHeader
        description="Each generate adds a new file. Download PDF or Word, or send the PDF for signature."
        title="Issued documents"
      />
      <details className="rounded-md border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Filter</summary>
        <form className="mt-3 flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-1">
            Type
            <select
              className="h-8 rounded-md border bg-background px-2"
              defaultValue={query.documentTypeId ?? ""}
              name="documentTypeId"
            >
              <option value="">All types</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            From
            <Input defaultValue={query.from ?? ""} name="from" type="date" />
          </label>
          <label className="flex flex-col gap-1">
            To
            <Input defaultValue={query.to ?? ""} name="to" type="date" />
          </label>
          <Button type="submit">Apply</Button>
        </form>
      </details>
      {rows.length === 0 ? (
        <EmptyState
          action={
            <Link href="/fill">
              <Button type="button">Fill a document</Button>
            </Link>
          }
          description="Fill a published type to issue a PDF and Word file."
          title="No issued documents yet"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <IssuedDocumentCard
                createdAt={row.createdAt}
                createdBy={row.createdByName ?? row.createdByEmail ?? "Unknown"}
                envelopeId={row.esignEnvelopeId}
                esignStatus={row.esignStatus}
                id={row.id}
                styleTheme={row.styleTheme}
                typeName={row.typeName}
              />
            </li>
          ))}
        </ul>
      )}
    </AppChrome>
  );
}
