import { desc, eq } from "drizzle-orm";
import { assets } from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { PLACEHOLDER_LOGO_PNG, type PdfLogo } from "@/lib/pdf/render";
import { getObjectBytes } from "@/lib/storage";
import type { StyleTheme } from "@/types/document-type";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolvePdfLogo(args: {
  organizationId: string;
  theme: StyleTheme;
}): Promise<PdfLogo> {
  const requested = args.theme.letterhead.logoAssetId?.trim();
  if (requested === "placeholder-logo") {
    return { kind: "png", bytes: PLACEHOLDER_LOGO_PNG };
  }
  if (requested && UUID_RE.test(requested)) {
    const fromType = await loadAssetPng(args.organizationId, requested);
    if (fromType) {
      return fromType;
    }
  }
  const orgDefault = await loadLatestOrgLogo(args.organizationId);
  if (orgDefault) {
    return orgDefault;
  }
  return { kind: "none" };
}

async function loadAssetPng(
  organizationId: string,
  assetId: string,
): Promise<PdfLogo | null> {
  const asset = await withOrganization(organizationId, async (db) => {
    const [found] = await db.select().from(assets).where(eq(assets.id, assetId));
    return found ?? null;
  });
  if (!asset || asset.organizationId !== organizationId) {
    return null;
  }
  try {
    return { kind: "png", bytes: await getObjectBytes(asset.objectKey) };
  } catch {
    return null;
  }
}

async function loadLatestOrgLogo(organizationId: string): Promise<PdfLogo | null> {
  const asset = await withOrganization(organizationId, async (db) => {
    const [logo] = await db
      .select()
      .from(assets)
      .where(eq(assets.kind, "org_logo"))
      .orderBy(desc(assets.createdAt))
      .limit(1);
    return logo ?? null;
  });
  if (!asset) {
    return null;
  }
  try {
    return { kind: "png", bytes: await getObjectBytes(asset.objectKey) };
  } catch {
    return null;
  }
}
