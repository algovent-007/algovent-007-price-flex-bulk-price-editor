import nodemailer from "nodemailer";

const DEFAULT_MAIL_FROM = "Price Flex <noreply@algovent.com>";

function parseMailFrom(value) {
  const trimmed = String(value || DEFAULT_MAIL_FROM).trim();
  const namedMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);

  if (namedMatch) {
    return {
      name: namedMatch[1].trim().replace(/^"|"$/g, ""),
      email: namedMatch[2].trim(),
    };
  }

  if (trimmed.includes("@")) {
    return { name: "Price Flex", email: trimmed };
  }

  return { name: "Price Flex", email: "noreply@algovent.com" };
}

function formatMailFrom(value) {
  const { name, email } = parseMailFrom(value);
  return `${name} <${email}>`;
}

async function sendViaSendGridApi({ to, subject, text, html }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;

  const from = parseMailFrom(process.env.MAIL_FROM);
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email via SendGrid: ${body}`);
  }

  return true;
}

async function sendViaResendApi({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatMailFrom(process.env.MAIL_FROM),
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email via Resend: ${body}`);
  }

  return true;
}

function getSmtpTransportOptions() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    return {
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || "",
          }
        : undefined,
    };
  }

  if (process.env.SENDGRID_API_KEY && process.env.MAIL_PROVIDER === "smtp") {
    return {
      host: "smtp.sendgrid.net",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    };
  }

  return null;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const transportOptions = getSmtpTransportOptions();
  if (!transportOptions) return false;

  const transporter = nodemailer.createTransport(transportOptions);
  await transporter.sendMail({
    from: formatMailFrom(process.env.MAIL_FROM),
    to,
    subject,
    text,
    html,
  });

  return true;
}

export function getConfiguredMailProvider() {
  if (process.env.MAIL_PROVIDER === "smtp" && getSmtpTransportOptions()) {
    return process.env.SMTP_HOST ? "smtp" : "sendgrid-smtp";
  }

  if (process.env.SENDGRID_API_KEY) {
    return "sendgrid";
  }

  if (getSmtpTransportOptions()) {
    return "smtp";
  }

  if (process.env.RESEND_API_KEY) {
    return "resend";
  }

  return null;
}

export async function sendEmail({ to, subject, text, html }) {
  const provider = getConfiguredMailProvider();

  if (provider === "sendgrid") {
    await sendViaSendGridApi({ to, subject, text, html });
    return;
  }

  if (provider === "smtp" || provider === "sendgrid-smtp") {
    await sendViaSmtp({ to, subject, text, html });
    return;
  }

  if (provider === "resend") {
    await sendViaResendApi({ to, subject, text, html });
    return;
  }

  console.log(
    "[mail] Email delivery is not configured. Set SENDGRID_API_KEY, SMTP_HOST, or RESEND_API_KEY.",
  );
  console.log("[mail] Would send:", { to, subject, text });
}
