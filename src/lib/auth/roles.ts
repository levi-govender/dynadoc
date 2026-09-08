import type { MembershipRole } from "@/lib/db/schema";

export class RoleForbiddenError extends Error {
  constructor(message = "Role is not allowed for this action") {
    super(message);
    this.name = "RoleForbiddenError";
  }
}

export const DRAFT_EDITOR_ROLES: readonly MembershipRole[] = [
  "author",
  "org_admin",
];

export const INSTANCE_GENERATOR_ROLES: readonly MembershipRole[] = [
  "operator",
  "author",
  "org_admin",
];

export const ORG_ADMIN_ROLES: readonly MembershipRole[] = ["org_admin"];

export function canEditDraft(role: MembershipRole) {
  return DRAFT_EDITOR_ROLES.includes(role);
}

export function canGenerateInstance(role: MembershipRole) {
  return INSTANCE_GENERATOR_ROLES.includes(role);
}

export function canManageOrganization(role: MembershipRole) {
  return ORG_ADMIN_ROLES.includes(role);
}

export function assertRole(
  membership: { role: MembershipRole },
  allowed: readonly MembershipRole[],
) {
  if (!allowed.includes(membership.role)) {
    throw new RoleForbiddenError();
  }
}
