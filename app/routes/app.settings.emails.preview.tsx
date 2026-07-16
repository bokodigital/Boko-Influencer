import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import {
  KLAVIYO_EVENTS,
  DEFAULT_TEMPLATES,
  renderTemplate,
  normalizeBodyHtml,
  applyBranding,
} from "../lib/klaviyo.server";
import type { KlaviyoEvent } from "../lib/klaviyo.server";

/** Realistic sample values substituted for every merge tag during preview. */
const SAMPLE_PROPS: Record<string, string> = {
  first_name: "Alex",
  amount: "$25.00",
  code: "ALEX15",
  referral_code: "ALEX15",
  link: "https://example.com/portal/login",
  order_id: "1001",
  method: "bank transfer",
  reward_title: "Free Product",
  reward_type: "gift",
  portal_login_url: "https://example.com/portal/login",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const event = url.searchParams.get("event") as KlaviyoEvent | null;

  if (!event || !(KLAVIYO_EVENTS as readonly string[]).includes(event)) {
    return new Response("Invalid or missing event parameter.", { status: 400 });
  }

  const [custom, settings] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { shop_event: { shop, event } } }),
    prisma.shopSettings.findUnique({
      where: { shop },
      select: { senderName: true, logoUrl: true, headingColor: true, buttonColor: true },
    }),
  ]);

  const template = custom ?? DEFAULT_TEMPLATES[event];
  const renderedBody = renderTemplate(template.body, SAMPLE_PROPS);
  const body = normalizeBodyHtml(renderedBody);
  const html = applyBranding(body, {
    logoUrl: settings?.logoUrl,
    headingColor: settings?.headingColor,
    buttonColor: settings?.buttonColor,
    shopName: settings?.senderName,
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
