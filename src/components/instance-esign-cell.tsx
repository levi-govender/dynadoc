"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Slot = { id: string; partyLabel: string; kind: string };

export function InstanceEsignCell(props: {
  instanceId: string;
  slots: Slot[];
  envelopeId: string | null;
  status: string | null;
}) {
  const [status, setStatus] = useState(props.status);
  const [envelopeId, setEnvelopeId] = useState(props.envelopeId);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (props.slots.length === 0) {
    return <span className="text-muted-foreground">No slots</span>;
  }

  async function post(body: unknown) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/instances/${props.instanceId}/esign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: unknown = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(
        json &&
          typeof json === "object" &&
          "error" in json &&
          typeof json.error === "string"
          ? json.error
          : "E-sign request failed",
      );
      return;
    }
    if (json && typeof json === "object") {
      if ("status" in json && typeof json.status === "string") {
        setStatus(json.status);
      }
      if ("envelopeId" in json && typeof json.envelopeId === "string") {
        setEnvelopeId(json.envelopeId);
      }
    }
  }

  if (envelopeId) {
    return (
      <div className="flex flex-col gap-1">
        <span>{status ?? "sent"}</span>
        <Button
          disabled={pending}
          onClick={() => void post({ action: "refresh" })}
          size="sm"
          type="button"
          variant="outline"
        >
          Refresh
        </Button>
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  return (
    <form
      className="flex max-w-xs flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void post({
          signers: props.slots.map((slot) => ({
            slotId: slot.id,
            email: emails[slot.id] ?? "",
          })),
        });
      }}
    >
      {props.slots.map((slot) => (
        <label className="flex flex-col gap-1 text-xs" key={slot.id}>
          {slot.partyLabel} ({slot.kind})
          <Input
            onChange={(event) =>
              setEmails((current) => ({
                ...current,
                [slot.id]: event.target.value,
              }))
            }
            required
            type="email"
            value={emails[slot.id] ?? ""}
          />
        </label>
      ))}
      <Button disabled={pending} size="sm" type="submit">
        Send for e-sign
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </form>
  );
}
