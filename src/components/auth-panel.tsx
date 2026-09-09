"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { formatRole } from "@/lib/auth/roles";
import type { MembershipRole } from "@/lib/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  signedIn: boolean;
  email?: string;
  organizationName?: string;
  role?: MembershipRole;
};

export function AuthPanel({ signedIn, email, organizationName, role }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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

  if (signedIn) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Signed in as {email}
            {organizationName ? ` · ${organizationName}` : ""}
            {role ? ` · ${formatRole(role)}` : ""}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === "signin" ? "Sign in" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Use your work email to continue."
            : "Creates your organization. You can invite authors and operators next."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) =>
            void (mode === "signup" ? onSignUp(event) : onSignIn(event))
          }
        >
          {mode === "signup" ? (
            <label className="flex flex-col gap-1 text-sm">
              Name
              <Input
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            Email
            <Input
              autoComplete="email"
              onChange={(event) => setFormEmail(event.target.value)}
              required
              type="email"
              value={formEmail}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <Input
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={pending} type="submit">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            type="button"
            variant="ghost"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
