import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { ensureOrganizationForUser } from "@/lib/auth/organizations";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

function resolveBetterAuthSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }
  // `next build` sets NODE_ENV=production while collecting pages; a missing
  // secret must not fail CI. Production runtimes still need a real secret.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-placeholder-secret-not-for-runtime";
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  return "dev-only-insecure-secret-change-me-32ch";
}

const secret = resolveBetterAuthSecret();

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensureOrganizationForUser({
            id: user.id,
            name: user.name,
            email: user.email,
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});
