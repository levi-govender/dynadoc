import type { ResolvedSignatureSlot } from "@/lib/document-types/signatures";
import { EsignError } from "@/lib/esign/errors";

export type EsignSignerInput = {
  slotId: string;
  email: string;
  name?: string;
};

export type DropboxSignField = {
  api_id: string;
  name: string;
  type: "signature" | "initials";
  x: number;
  y: number;
  width: number;
  height: number;
  required: true;
  signer: number;
  page: number;
};

export type DropboxSignSigner = {
  email_address: string;
  name: string;
};

export function mapSlotsToDropboxSign(args: {
  slots: ResolvedSignatureSlot[];
  signers: EsignSignerInput[];
}): {
  signers: DropboxSignSigner[];
  formFields: DropboxSignField[];
} {
  const emailBySlot = new Map(
    args.signers.map((signer) => [signer.slotId, signer] as const),
  );
  const signers: DropboxSignSigner[] = [];
  const formFields: DropboxSignField[] = [];

  args.slots.forEach((slot, index) => {
    const input = emailBySlot.get(slot.id);
    if (!input?.email.trim()) {
      throw new EsignError(`Missing email for signature slot ${slot.id}`);
    }
    const name =
      input.name?.trim() ||
      slot.partyName?.trim() ||
      slot.partyLabel ||
      `Signer ${index + 1}`;
    signers.push({
      email_address: input.email.trim(),
      name,
    });
    const initials = slot.kind === "initials";
    formFields.push({
      api_id: slot.id,
      name: slot.partyLabel,
      type: initials ? "initials" : "signature",
      x: 72,
      y: 120 + index * 72,
      width: initials ? 80 : 160,
      height: 36,
      required: true,
      signer: index,
      page: 1,
    });
  });

  return { signers, formFields };
}
