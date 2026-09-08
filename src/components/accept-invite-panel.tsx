"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export function AcceptInvitePanel({
  token,
  organizationName,
  invitedEmail,
  role,
  signedInEmail,
}: {
  token: string;
  organizationName: string;
  invitedEmail: string;
  role: string;
  signedInEmail?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    const response = await fetch(`/api/org/invites/${token}/accept`, {
      method: "POST",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      setError(
        payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
          ? payload.error
          : "Could not accept invite",
      );
      return false;
    }
    router.push("/");
    router.refresh();
    return true;
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-xl border p-4">
      <p className="text-sm">
        Join <strong>{organizationName}</strong> as <strong>{role}</strong> (
        {invitedEmail}).
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {signedInEmail ? (
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            void accept().finally(() => setPending(false));
          }}
          type="button"
        >
          Accept invite
        </Button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            void authClient.signUp
              .email({
                name: name || invitedEmail.split("@")[0] || "Member",
                email: invitedEmail,
                password,
              })
              .then(async ({ error: signUpError }) => {
                if (signUpError) {
                  const signIn = await authClient.signIn.email({
                    email: invitedEmail,
                    password,
                  });
                  if (signIn.error) {
                    setPending(false);
                    setError(signUpError.message ?? "Sign up failed");
                    return;
                  }
                }
                await accept();
                setPending(false);
              });
          }}
        >
          <Input
            aria-label="Name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            value={name}
          />
          <Input disabled readOnly value={invitedEmail} />
          <Input
            aria-label="Password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (min 8 characters)"
            type="password"
            value={password}
          />
          <Button disabled={pending || password.length < 8} type="submit">
            Create account and join
          </Button>
        </form>
      )}
    </div>
  );
}
