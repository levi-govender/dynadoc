import Link from "next/link";
import { InstanceEsignCell } from "@/components/instance-esign-cell";
import { issuedStatusLabel } from "@/lib/esign/issued-status";
import { slotsForTheme } from "@/lib/esign/send";

type Props = {
  id: string;
  typeName: string;
  createdAt: Date;
  createdBy: string;
  envelopeId: string | null;
  esignStatus: string | null;
  styleTheme: unknown;
};

export function IssuedDocumentCard({
  id,
  typeName,
  createdAt,
  createdBy,
  envelopeId,
  esignStatus,
  styleTheme,
}: Props) {
  const when = createdAt.toISOString().replace("T", " ").slice(0, 16);
  const status = issuedStatusLabel({
    envelopeId,
    status: esignStatus,
  });
  let slots: Array<{ id: string; partyLabel: string; kind: string }> = [];
  try {
    slots = slotsForTheme(styleTheme, {}).map((slot) => ({
      id: slot.id,
      partyLabel: slot.partyLabel,
      kind: slot.kind,
    }));
  } catch {
    slots = [];
  }

  return (
    <article className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{typeName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {createdBy} · {when} UTC
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {status}
        </span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-primary">
          Download
        </summary>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            className="text-primary hover:underline"
            href={`/api/instances/${id}/pdf`}
          >
            PDF
          </Link>
          <Link
            className="text-primary hover:underline"
            href={`/api/instances/${id}/docx`}
          >
            Word
          </Link>
        </div>
      </details>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Signature
        </p>
        <InstanceEsignCell
          envelopeId={envelopeId}
          instanceId={id}
          slots={slots}
          status={esignStatus}
        />
      </div>
    </article>
  );
}
