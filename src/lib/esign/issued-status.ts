export function issuedStatusLabel(args: {
  envelopeId: string | null;
  status: string | null;
}) {
  if (!args.envelopeId) {
    return "Issued";
  }
  const status = (args.status ?? "sent").toLowerCase();
  if (status === "completed" || status === "signed") {
    return "Signed";
  }
  if (
    status === "declined" ||
    status === "canceled" ||
    status === "cancelled"
  ) {
    return "Cancelled";
  }
  return "Sent for signature";
}
