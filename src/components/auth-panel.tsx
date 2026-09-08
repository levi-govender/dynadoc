"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

import type { MembershipRole } from "@/lib/db/schema";

type Props = {
  signedIn: boolean;
  email?: string;
  organizationName?: string;
  role?: MembershipRole;
};

export function AuthPanel({ signedIn, email, organizationName, role }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    router.refresh();
  }

  async function onSignUp(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email: formEmail,
      password,
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "Sign up failed");
      return;
    }
    await refresh();
  }

  async function onSignIn(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: formEmail,
      password,
    });
    setPending(false);
    if (signInError) {
      setError(signInError.message ?? "Sign in failed");
      return;
    }
    await refresh();
  }

  async function onSignOut() {
    setPending(true);
    await authClient.signOut();
    setPending(false);
    await refresh();
  }

  if (signedIn) {
    return (
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-xl border p-4 text-sm">
        <p>
          Signed in as <strong>{email}</strong>
        </p>
        <p>
          Organization <strong>{organizationName}</strong> ({role})
        </p>
        <Button disabled={pending} onClick={() => void onSignOut()} type="button">
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <form className="flex w-full max-w-lg flex-col gap-3 rounded-xl border p-4">
      <Input
        aria-label="Name"
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        value={name}
      />
      <Input
        aria-label="Email"
        onChange={(event) => setFormEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={formEmail}
      />
      <Input
        aria-label="Password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password (min 8 characters)"
        type="password"
        value={password}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending} onClick={(event) => void onSignUp(event)} type="submit">
          Sign up
        </Button>
        <Button
          disabled={pending}
          onClick={(event) => void onSignIn(event)}
          type="button"
          variant="outline"
        >
          Sign in
        </Button>
      </div>
    </form>
  );
}
