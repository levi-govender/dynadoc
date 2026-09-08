import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MembershipRequiredError } from "@/lib/auth/organizations";
import { RoleForbiddenError } from "@/lib/auth/roles";
import {
  AlreadyMemberError,
  InviteEmailMismatchError,
  InviteExpiredError,
  InviteNotFoundError,
} from "@/lib/auth/invites";
import {
  documentTypeErrorStatus,
  isDocumentTypeClientError,
} from "@/lib/document-types/versions";

export function toAuthzResponse(error: unknown) {
  if (
    error instanceof MembershipRequiredError ||
    error instanceof RoleForbiddenError
  ) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof InviteNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AlreadyMemberError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof InviteExpiredError ||
    error instanceof InviteEmailMismatchError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (isDocumentTypeClientError(error) && error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: documentTypeErrorStatus(error) },
    );
  }
  return null;
}
