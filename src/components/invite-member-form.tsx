"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"operator" | "author" | "org_admin">(
    "operator",
  );
  const [error, setError] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        setAcceptUrl(null);
        setDelivered(null);
        void fetch("/api/org/invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, role }),
        }).then(async (response) => {
          const payload: unknown = await response.json().catch(() => null);
          setPending(false);
          if (!response.ok) {
            setError(
              payload &&
                typeof payload === "object" &&
                "error" in payload &&
                typeof payload.error === "string"
                ? payload.error
                : "Could not send invite",
            );
            return;
          }
          if (
            payload &&
            typeof payload === "object" &&
            "acceptUrl" in payload &&
            typeof payload.acceptUrl === "string"
          ) {
            setAcceptUrl(payload.acceptUrl);
            setDelivered("delivered" in payload && payload.delivered === true);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Email
        <Input
          onChange={(event) => setEmail(event.target.value)}
          placeholder="colleague@company.com"
          type="email"
          value={email}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Role
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          onChange={(event) =>
            setRole(event.target.value as "operator" | "author" | "org_admin")
          }
          value={role}
        >
          <option value="operator">Operator — fill and generate</option>
          <option value="author">Author — design and publish</option>
          <option value="org_admin">Admin — invites and branding</option>
        </select>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {acceptUrl ? (
        <p className="text-sm">
          {delivered
            ? "Invite email sent. Magic link (also copied here): "
            : "SMTP is not configured; share this magic link: "}
          <a className="underline" href={acceptUrl}>
            {acceptUrl}
          </a>
        </p>
      ) : null}
      <Button disabled={pending || !email.trim()} type="submit">
        Invite
      </Button>
    </form>
  );
}
