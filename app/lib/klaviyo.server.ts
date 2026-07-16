// Notification dispatch for the Boko Influencer Program.
// Priority per shop:
//   1. If the shop has connected their own Klaviyo account (Settings > Emails),
//      push the event to Klaviyo and let their flow send the email.
//   2. Otherwise, send a built-in transactional email via Resend, using the
//      shop's saved template if they've customized it, or a sensible default.
import { prisma } from "./db.server";
import { decryptValue } from "./crypto.server";

export const KLAVIYO_EVENTS = [
  "Influencer Registered",
  "Influencer Approved",
  "Influencer Rejected",
  "Commission Earned",
  "Reward Unlocked",
  "Payout Processed",
  "Discount Code Created",
  "Referral Generated",
  "Portal Login Link",
  "New Order via Referral",
] as const;

export type KlaviyoEvent = (typeof KLAVIYO_EVENTS)[number];

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Update VERIFIED_SENDER_ADDRESS once a real domain is verified in Resend.
const VERIFIED_SENDER_ADDRESS = "onboarding@resend.dev";
const DEFAULT_FROM = `Influencer Program <${VERIFIED_SENDER_ADDRESS}>`;

export const DEFAULT_TEMPLATES: Record<KlaviyoEvent, { subject: string; body: string }> = {
  "Influencer Registered": {
    subject: "We've received your Boko Influencer Program application",
    body: "Hi {{first_name}},\n\nThanks for applying to the Boko Influencer Program. We review every application manually and you'll hear back from us within 2 business days.",
  },
  "Influencer Approved": {
    subject: "You're in — welcome to the Boko Influencer Program",
    body: "Hi {{first_name}},\n\nYour application has been approved. Your referral code is {{referral_code}}. Log in to your dashboard here: {{portal_login_url}}",
  },
  "Influencer Rejected": {
    subject: "An update on your Boko Influencer Program application",
    body: "Hi {{first_name}},\n\nAfter review, we're not able to move forward with your application at this time. We'd love to hear from you again in future.",
  },
  "Commission Earned": {
    subject: "You just earned a commission",
    body: "Hi {{first_name}},\n\nYou've earned a new commission of {{amount}} from order #{{order_id}}. It's been added to your pending balance.",
  },
  "Reward Unlocked": {
    subject: "Reward unlocked: {{reward_title}}",
    body: "Hi {{first_name}},\n\nYou've hit a milestone and unlocked: {{reward_title}} ({{reward_type}}). Keep sharing your referral link!",
  },
  "Payout Processed": {
    subject: "Your payout is on its way",
    body: "Hi {{first_name}},\n\nYour commission payout of {{amount}} has been processed via {{method}}. Funds typically land within 1-3 business days.",
  },
  "Discount Code Created": {
    subject: "Your new discount code is ready: {{code}}",
    body: "Hi {{first_name}},\n\nA new discount code has been set up for your audience: {{code}}. Every order placed with it is automatically tracked back to you.",
  },
  "Referral Generated": {
    subject: "Someone just clicked your referral link",
    body: "Hi {{first_name}},\n\nYour referral link just got a new click.",
  },
  "Portal Login Link": {
    subject: "Your Boko Influencer Portal login link",
    body: "Hi {{first_name}},\n\nClick here to log in to your dashboard: {{link}}\n\nThis link is valid for 15 minutes. Didn't request this? You can safely ignore this email.",
  },
  "New Order via Referral": {
    subject: "Someone just shopped using your link",
    body: "Hi {{first_name}},\n\nA customer just placed an order using your referral code {{referral_code}}. We're calculating your commission now.",
  },
};

function renderTemplate(text: string, context: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

async function getCurrentShop(): Promise<string | null> {
  const session = await prisma.session.findFirst({ select: { shop: true } });
  return session?.shop ?? null;
}

async function getShopKlaviyoKey(shop: string): Promise<string | null> {
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  if (!settings?.klaviyoApiKeyEncrypted) return null;
  try {
    return decryptValue(settings.klaviyoApiKeyEncrypted);
  } catch {
    return null;
  }
}

async function pushToKlaviyo(
  apiKey: string,
  event: KlaviyoEvent,
  email: string,
  properties: Record<string, unknown>,
) {
  const res = await fetch("https://a.klaviyo.com/api/events/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      revision: "2024-10-15",
    },
    body: JSON.stringify({
      data: {
        type: "event",
        attributes: {
          properties,
          metric: { data: { type: "metric", attributes: { name: event } } },
          profile: { data: { type: "profile", attributes: { email } } },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Klaviyo event push failed: ${res.status} ${await res.text()}`);
  }
}

async function getShopSenderFrom(shop: string): Promise<string> {
  const settings = await prisma.shopSettings.findUnique({
    where: { shop },
    select: { senderName: true },
  });
  if (!settings) return DEFAULT_FROM; // no row at all — use the global default
  const name = settings.senderName?.trim();
  return `${name || "Influencer Program"} <${VERIFIED_SENDER_ADDRESS}>`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendViaResend(to: string, subject: string, html: string, from: string = DEFAULT_FROM) {
  const text = htmlToPlainText(html);
  if (!RESEND_API_KEY) {
    console.warn(`[email fallback - no RESEND_API_KEY set] to ${to}: ${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

interface BrandingOptions {
  logoUrl?: string | null;
  headingColor?: string | null;
  buttonColor?: string | null;
}

function applyBranding(body: string, { logoUrl, headingColor, buttonColor }: BrandingOptions): string {
  const hColor = headingColor || "#000000";
  const bColor = buttonColor || "#000000";

  // Inject heading colour as inline style on h1/h2/h3 opening tags.
  let styled = body.replace(
    /<(h[123])([\s>])/gi,
    (_, tag, next) => `<${tag} style="color:${hColor}"${next === ">" ? ">" : " " + next}`,
  );

  // Style every <a …> as a CTA button.
  const btnStyle = [
    `display:inline-block`,
    `padding:10px 20px`,
    `background-color:${bColor}`,
    `color:#ffffff`,
    `border-radius:4px`,
    `text-decoration:none`,
    `font-weight:600`,
  ].join(";");
  styled = styled.replace(/<a(\s)/gi, `<a style="${btnStyle}"$1`);

  // Logo row (only when URL is set).
  const logoRow = logoUrl
    ? `<tr><td align="center" style="padding:32px 40px 0">` +
      `<img src="${logoUrl}" alt="" style="max-height:60px;display:block"></td></tr>`
    : "";

  return [
    `<!DOCTYPE html>`,
    `<html>`,
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`,
    `<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">`,
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">`,
    `<tr><td align="center" style="padding:40px 16px">`,
    `<table cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;max-width:600px;width:100%">`,
    logoRow,
    `<tr><td style="padding:32px 40px;font-size:15px;line-height:1.6;color:#202223">${styled}</td></tr>`,
    `<tr><td align="center" style="padding:24px 40px;font-size:12px;color:#8c9196;border-top:1px solid #e1e3e5">`,
    `You're receiving this email because you're a member of our influencer program.`,
    `</td></tr>`,
    `</table>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join("\n");
}

async function sendBuiltInEmail(
  shop: string,
  event: KlaviyoEvent,
  email: string,
  properties: Record<string, unknown>,
) {
  const [custom, from, branding] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { shop_event: { shop, event } } }),
    getShopSenderFrom(shop),
    prisma.shopSettings.findUnique({
      where: { shop },
      select: { logoUrl: true, headingColor: true, buttonColor: true },
    }),
  ]);

  if (custom && !custom.enabled) return; // merchant explicitly turned this email off

  const template = custom ?? DEFAULT_TEMPLATES[event];
  const subject = renderTemplate(template.subject, properties);
  const body = renderTemplate(template.body, properties);
  const html = applyBranding(body, {
    logoUrl: branding?.logoUrl,
    headingColor: branding?.headingColor,
    buttonColor: branding?.buttonColor,
  });
  await sendViaResend(email, subject, html, from);
}

export async function notify(
  event: KlaviyoEvent,
  influencerId: string,
  properties: Record<string, unknown> = {},
) {
  const influencer = await prisma.influencer.findUniqueOrThrow({
    where: { id: influencerId },
  });

  const shop = await getCurrentShop();
  const klaviyoKey = shop ? await getShopKlaviyoKey(shop) : null;

  const notification = await prisma.notification.create({
    data: {
      influencerId,
      type: "event",
      channel: klaviyoKey ? "klaviyo" : "email",
      payload: properties as any,
      status: "queued",
    },
  });

  try {
    if (klaviyoKey) {
      await pushToKlaviyo(klaviyoKey, event, influencer.email, properties);
    } else if (shop) {
      await sendBuiltInEmail(shop, event, influencer.email, {
        first_name: influencer.firstName,
        ...properties,
      });
    } else {
      console.warn(`[notify] no shop session found, skipping send for ${event}`);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "sent", sentAt: new Date() },
    });
  } catch (err) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "failed" },
    });
    console.error(`[notify] failed to send notification for event "${event}", influencer ${influencerId}:`, err);
  }
}
