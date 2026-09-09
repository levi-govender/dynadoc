import assert from "node:assert/strict";
import test from "node:test";
import { toAuthzResponse } from "@/lib/auth/authz";
import {
  InvalidNotificationTypeError,
  NotificationNotFoundError,
  parseNotificationType,
} from "./index";

test("parseNotificationType accepts ingest and generic kinds only", () => {
  assert.equal(parseNotificationType("generic"), "generic");
  assert.equal(parseNotificationType("ingest_holdout"), "ingest_holdout");
  assert.equal(parseNotificationType("ingest_rereview"), "ingest_rereview");
  assert.throws(
    () => parseNotificationType("email"),
    InvalidNotificationTypeError,
  );
});

test("missing inbox row maps to HTTP 404", () => {
  const response = toAuthzResponse(new NotificationNotFoundError());
  assert.equal(response?.status, 404);
});
