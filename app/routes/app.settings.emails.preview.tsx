import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import {
  KLAVIYO_EVENTS,
  DEFAULT_TEMPLATES,
  ADMIN_EVENTS,
  DEFAULT_ADMIN_TEMPLATES,
  renderTemplate,
  normalizeBodyHtml,
  applyBranding,
} from "../lib/klaviyo.server";

/** Realistic sample values substituted for every merge tag during preview. */
const SAMPLE_PROPS: Record<string, string> = {
  first_name: "Alex",
  last_name: "Taylor",
  amount: "$25.00",
  code: "ALEX15",
  referral_code: "ALEX15",
  link: "https://example.com/portal/login",
  order_id: "1001",
  method: "bank transfer",
  reward_title: "Free Product",
  reward_type: "gift",
  portal_login_url: "https://example.com/portal/login",
  // Admin-facing sample values
  influencer_name: "Alex Taylor",
  influencer_email: "alex@example.com",
  store_name: "Your Store",
  shop_name: "Your Store",
  email: "alex@example.com",
  phone: "+61 400 000 000",
  instagram: "@alextaylor",
  tiktok: "@alextaylor",
  audience_size: "25,000",
  review_link: "https://example.com/app/influencers",
  admin_link: "https://example.com/app/influencers",
};

// Every event the settings page can show a card for — influencer + admin.
const ALL_EVENTS: readonly string[] = [...KLAVIYO_EVENTS, ...ADMIN_EVENTS];
// Merged default templates so we can preview either family from one lookup.
const ALL_DEFAULTS: Record<string, { subject: string; body: string }> = {
  ...DEFAULT_TEMPLATES,
  ...DEFAULT_ADMIN_TEMPLATES,
};

/**
 * Returns JSON { html } so Remix Single Fetch (the .data URL) can populate
 * useFetcher.data correctly. The HTML is rendered in an <iframe srcDoc> in the
 * TemplateCard modal — no new tab needed, no OAuth redirect.
 *
 * Handles BOTH influencer-facing events (KLAVIYO_EVENTS) and admin-facing
 * events (ADMIN_EVENTS) so every template card can be previewed.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const event = url.searchParams.get("event");

  if (!event || !ALL_EVENTS.includes(event)) {
    return json({ html: "<p>Invalid or missing event parameter.</p>" }, { status: 400 });
  }

  const [custom, settings] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { shop_event: { shop, event } } }),
    prisma.shopSettings.findUnique({
      where: { shop },
      select: { senderName: true, logoUrl: true, headingColor: true, buttonColor: true },
    }),
  ]);

  const template = custom ?? ALL_DEFAULTS[event];
  if (!template) {
    return json({ html: "<p>No template found for this event.</p>" }, { status: 404 });
  }

  const renderedSubject = renderTemplate(template.subject, SAMPLE_PROPS);
  const renderedBody = renderTemplate(template.body, SAMPLE_PROPS);
  const body = normalizeBodyHtml(renderedBody);
  const html = applyBranding(body, {
    logoUrl: settings?.logoUrl,
    headingColor: settings?.headingColor,
    buttonColor: settings?.buttonColor,
    shopName: settings?.senderName,
    heading: renderedSubject,
  });

  return json({ html });
}
