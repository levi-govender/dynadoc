import { NextResponse } from "next/server";
import { MembershipRequiredError } from "@/lib/auth/organizations";
import { RoleForbiddenError } from "@/lib/auth/roles";
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
  if (isDocumentTypeClientError(error) && error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: documentTypeErrorStatus(error) },
    );
  }
  return null;
}
