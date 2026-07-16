// Called by the storefront theme app extension when a page loads with a
// ?ref=<referralCode> param. Logs the click and sets the attribution cookie
// that checkout later reads back into an order note attribute.

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import { prisma } from "../lib/db.server";

const ATTRIBUTION_WINDOW_DAYS = 30;

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { referralCode, userAgent, referrer, country } = body as {
    referralCode: string;
    userAgent?: string;
    referrer?: string;
    country?: string;
  };

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode },
  });

  if (!influencer || influencer.status !== "approved") {
    return json({ ok: false, reason: "unknown_or_inactive_influencer" }, { status: 404 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  await prisma.click.create({
    data: {
      influencerId: influencer.id,
      ipHash,
      userAgent,
      referrer,
      country,
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

function deviceTypeFromUserAgent(ua?: string) {
  if (!ua) return "unknown";
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
}
