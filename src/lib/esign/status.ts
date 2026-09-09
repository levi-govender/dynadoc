export const ESIGN_PROVIDER_DROPBOX_SIGN = "dropbox_sign";

export type EsignStatus =
  "sent" | "signed" | "completed" | "declined" | "canceled";

export function mapDropboxSignEventType(eventType: string): EsignStatus | null {
  switch (eventType) {
    case "signature_request_sent":
    case "signature_request_viewed":
      return "sent";
    case "signature_request_signed":
      return "signed";
    case "signature_request_all_signed":
      return "completed";
    case "signature_request_declined":
      return "declined";
    case "signature_request_canceled":
    case "signature_request_invalid":
      return "canceled";
    default:
      return null;
  }
}

export function mapDropboxSignRequest(payload: {
  is_complete?: boolean;
  is_declined?: boolean;
}): EsignStatus {
  if (payload.is_declined) {
    return "declined";
  }
  if (payload.is_complete) {
    return "completed";
  }
  return "sent";
}
