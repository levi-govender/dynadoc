import { InstanceEsignCell } from "@/components/instance-esign-cell";
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
import { slotsForTheme } from "@/lib/esign/send";
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
            History is only available to operators, authors, and org admins.
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
        description="Issued files are never overwritten. Download PDF or Word, or send the PDF for e-sign."
        title="History"
      />
      <form
        className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4"
        method="get"
      >
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
        <EmptyState
          description="Generate a document from Fill. Each generate adds a row here."
          title="No generated documents yet"
        />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">PDF</th>
                <th className="px-4 py-2 font-medium">Word</th>
                <th className="px-4 py-2 font-medium">E-sign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.id}>
                  <td className="px-4 py-3">
                    {row.typeName}{" "}
                    <span className="text-muted-foreground">
                      ({row.typeSlug})
                    </span>
                  </td>
                  <td className="px-4 py-3">v{row.versionNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.createdAt.toISOString().replace("T", " ").slice(0, 16)}{" "}
                    UTC
                  </td>
                  <td className="px-4 py-3">
                    {row.createdByName ?? row.createdByEmail ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/api/instances/${row.id}/pdf`}
                    >
                      PDF
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/api/instances/${row.id}/docx`}
                    >
                      Word
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <InstanceEsignCell
                      envelopeId={row.esignEnvelopeId}
                      instanceId={row.id}
                      slots={(() => {
                        try {
                          return slotsForTheme(row.styleTheme, {}).map(
                            (slot) => ({
                              id: slot.id,
                              partyLabel: slot.partyLabel,
                              kind: slot.kind,
                            }),
                          );
                        } catch {
                          return [];
                        }
                      })()}
                      status={row.esignStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppChrome>
  );
}
