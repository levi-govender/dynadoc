export const LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 50 * 1024 * 1024;

export function buildObjectKey(
  orgId: string,
  documentTypeId: string,
  ...parts: string[]
): string {
  const segments = [orgId, documentTypeId, ...parts].map((part) => {
    const trimmed = part.trim();
    if (!trimmed || trimmed.includes("..") || trimmed.includes("/")) {
      throw new Error(`Invalid object key segment: ${part}`);
    }
    return trimmed;
  });
  return segments.join("/");
}

export function assertWithinSizeLimit(byteLength: number, maxBytes: number): void {
  if (byteLength > maxBytes) {
    throw new Error(`Object is ${byteLength} bytes; max allowed is ${maxBytes}`);
  }
}
