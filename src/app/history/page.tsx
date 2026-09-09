import { AppNav } from "@/components/app-nav";
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
        <div className="flex flex-1 flex-col gap-4 p-8">
          <AppNav role={membership.role} />
          <p>History is only available to operators, authors, and org admins.</p>
        </div>
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
    <div className="flex flex-1 flex-col gap-6 p-8">
      <AppNav role={membership.role} />
      <h1 className="text-xl font-semibold">Generated documents</h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
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
        <label className="flex flex-col gap-1 text-sm">
          From
          <Input defaultValue={query.from ?? ""} name="from" type="date" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <Input defaultValue={query.to ?? ""} name="to" type="date" />
        </label>
        <Button type="submit">Filter</Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No generated documents yet.</p>
      ) : (
        <table className="max-w-4xl text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Version</th>
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Who</th>
              <th className="py-2">PDF</th>
              <th className="py-2">Word</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b" key={row.id}>
                <td className="py-2 pr-4">
                  {row.typeName}{" "}
                  <span className="text-muted-foreground">({row.typeSlug})</span>
                </td>
                <td className="py-2 pr-4">v{row.versionNumber}</td>
                <td className="py-2 pr-4">
                  {row.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                </td>
                <td className="py-2 pr-4">
                  {row.createdByName ?? row.createdByEmail ?? "Unknown"}
                </td>
                <td className="py-2 pr-4">
                  <Link className="underline" href={`/api/instances/${row.id}/pdf`}>
                    PDF
                  </Link>
                </td>
                <td className="py-2">
                  <Link className="underline" href={`/api/instances/${row.id}/docx`}>
                    Word
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
