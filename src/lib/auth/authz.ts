import { NextResponse } from "next/server";
import { MembershipRequiredError } from "@/lib/auth/organizations";
import { RoleForbiddenError } from "@/lib/auth/roles";

export function toAuthzResponse(error: unknown) {
  if (
    error instanceof MembershipRequiredError ||
    error instanceof RoleForbiddenError
  ) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}
