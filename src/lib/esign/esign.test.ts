import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { resolveThemeSignatures } from "@/lib/document-types/signatures";
import {
  parseDropboxSignWebhookPayload,
  verifyDropboxSignEventHash,
} from "@/lib/esign/dropbox-sign";
import { EsignError } from "@/lib/esign/errors";
import {
  mapDropboxSignEventType,
  mapDropboxSignRequest,
} from "@/lib/esign/status";
import { mapSlotsToDropboxSign } from "@/lib/esign/tabs";

const snapshot = parseDocumentTypeVersionSnapshot(fixture);

test("signature slots map to Dropbox Sign signers and tabs", () => {
  const slots = resolveThemeSignatures(snapshot.styleTheme, {
    employeeName: "Alex Rivera",
    employerName: "Acme Ltd",
  });
  const mapped = mapSlotsToDropboxSign({
    slots,
    signers: [
      { slotId: "employee", email: "alex@example.com" },
      { slotId: "employer", email: "hr@example.com", name: "HR" },
    ],
  });
  assert.equal(mapped.signers.length, 2);
  assert.equal(mapped.signers[0]?.email_address, "alex@example.com");
  assert.equal(mapped.signers[0]?.name, "Alex Rivera");
  assert.equal(mapped.signers[1]?.name, "HR");
  assert.equal(mapped.formFields[0]?.type, "signature");
  assert.equal(mapped.formFields[0]?.api_id, "employee");
  assert.equal(mapped.formFields[0]?.signer, 0);
  assert.equal(mapped.formFields[1]?.signer, 1);
});

test("missing signer email is rejected", () => {
  const slots = resolveThemeSignatures(snapshot.styleTheme, {});
  assert.throws(
    () =>
      mapSlotsToDropboxSign({
        slots,
        signers: [{ slotId: "employee", email: "alex@example.com" }],
      }),
    EsignError,
  );
});

test("Dropbox Sign all-signed event is completed", () => {
  assert.equal(
    mapDropboxSignEventType("signature_request_all_signed"),
    "completed",
  );
  assert.equal(mapDropboxSignRequest({ is_complete: true }), "completed");
});

test("webhook payload carries instance metadata", () => {
  const parsed = parseDropboxSignWebhookPayload({
    event: { event_type: "signature_request_all_signed", event_time: "1" },
    signature_request: {
      signature_request_id: "env-1",
      is_complete: true,
      metadata: {
        organization_id: "org-1",
        instance_id: "inst-1",
      },
    },
  });
  assert.equal(parsed.envelopeId, "env-1");
  assert.equal(parsed.organizationId, "org-1");
  assert.equal(parsed.instanceId, "inst-1");
  assert.equal(parsed.eventType, "signature_request_all_signed");
});

test("Dropbox Sign event hash verifies", () => {
  const apiKey = "test-key";
  const eventTime = "123";
  const eventType = "signature_request_all_signed";
  const eventHash = createHmac("sha256", apiKey)
    .update(`${eventTime}${eventType}`)
    .digest("hex");
  assert.equal(
    verifyDropboxSignEventHash({ apiKey, eventTime, eventType, eventHash }),
    true,
  );
  assert.equal(
    verifyDropboxSignEventHash({
      apiKey,
      eventTime,
      eventType,
      eventHash: "00",
    }),
    false,
  );
});
