import assert from "node:assert/strict";
import test from "node:test";
import { composeInviteEmail, smtpConfigured } from "./send-invite-email";

test("invite email includes the magic-link accept URL", () => {
  const message = composeInviteEmail({
    to: "a@example.com",
    organizationName: "Acme",
    role: "author",
    acceptUrl: "http://localhost:3000/invite/abc",
  });
  assert.match(message.subject, /Acme/);
  assert.match(message.text, /author/);
  assert.match(message.text, /http:\/\/localhost:3000\/invite\/abc/);
});

test("SMTP is off unless SMTP_URL is set", () => {
  const previous = process.env.SMTP_URL;
  delete process.env.SMTP_URL;
  assert.equal(smtpConfigured(), false);
  process.env.SMTP_URL = "smtp://localhost:1025";
  assert.equal(smtpConfigured(), true);
  if (previous === undefined) {
    delete process.env.SMTP_URL;
  } else {
    process.env.SMTP_URL = previous;
  }
});
