import nodemailer from "nodemailer";

export type InviteEmailInput = {
  to: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
};

export function composeInviteEmail(input: InviteEmailInput) {
  const subject = `Join ${input.organizationName} on Dynadoc`;
  const text = [
    `You were invited to ${input.organizationName} as ${input.role}.`,
    ``,
    `Open this magic link to accept:`,
    input.acceptUrl,
    ``,
    `If you did not expect this, ignore the email.`,
  ].join("\n");
  return { subject, text };
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_URL?.trim());
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const message = composeInviteEmail(input);
  const smtpUrl = process.env.SMTP_URL?.trim();
  if (!smtpUrl) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      throw new Error("SMTP_URL is not set");
    }
    console.info(`[dynadoc invite] ${input.to} ${input.acceptUrl}`);
    return { delivered: false as const, ...message };
  }

  const from = process.env.EMAIL_FROM?.trim() || "Dynadoc <noreply@localhost>";
  const transport = nodemailer.createTransport(smtpUrl);
  await transport.sendMail({
    from,
    to: input.to,
    subject: message.subject,
    text: message.text,
  });
  return { delivered: true as const, ...message };
}
