// Shopify App Proxy handler - Shopify signs and forwards storefront
// requests from yourstore.com/apps/<subpath>/* to this route. Used by the
// theme app extension for click tracking, so the storefront never talks to
// our app domain directly (avoids CORS and lets Shopify verify the request
// with an HMAC signature before it reaches us).
//
// authenticate.public.appProxy(request) verifies that signature - if it's
// missing or invalid, it throws/responds automatically. Only traffic that
// genuinely came through Shopify's proxy reaches the code below.

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";

const ATTRIBUTION_WINDOW_DAYS = 30;

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const referralCode = url.searchParams.get("ref");
  const shop = url.searchParams.get("shop") || "";

  if (!referralCode) {
    return json({ ok: false, reason: "missing_ref" }, { status: 400 });
  }

  const influencer = await prisma.influencer.findFirst({ where: { referralCode, shop },
  });

  if (!influencer || influencer.status !== "approved") {
    return json({ ok: false, reason: "unknown_or_inactive_influencer" }, { status: 404 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const referrer = request.headers.get("referer") ?? undefined;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  await prisma.click.create({
    data: {
      influencerId: influencer.id,
      ipHash,
      userAgent,
      referrer,
      deviceType: deviceTypeFromUserAgent(userAgent),
    },
  });

  const expires = new Date();
  expires.setDate(expires.getDate() + ATTRIBUTION_WINDOW_DAYS);

  return json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `boko_ref=${referralCode}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax`,
      },
    }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  return loader({ request } as LoaderFunctionArgs);
}

function deviceTypeFromUserAgent(ua?: string) {
  if (!ua) return "unknown";
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}
