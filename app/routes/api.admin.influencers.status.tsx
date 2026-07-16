// Admin-only action: approve/reject/disable/re-enable an influencer.
// Posted to by app/components/admin/InfluencerManagement.tsx's fetcher.

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { notify } from "../lib/klaviyo.server";

const VALID_STATUSES = ["pending", "approved", "rejected", "disabled"] as const;

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const form = await request.formData();
  const influencerId = form.get("influencerId");
  const status = form.get("status");

  if (typeof influencerId !== "string" || typeof status !== "string") {
    return json({ ok: false, error: "Missing influencerId or status" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return json({ ok: false, error: `Invalid status: ${status}` }, { status: 400 });
  }

  const influencer = await prisma.influencer.update({
    where: { id: influencerId },
    data: { status: status as (typeof VALID_STATUSES)[number] },
  });

  if (status === "approved") {
    await notify("Influencer Approved", influencer.id);
  } else if (status === "rejected") {
    await notify("Influencer Rejected", influencer.id);
  }

  return json({ ok: true, influencer });
}
