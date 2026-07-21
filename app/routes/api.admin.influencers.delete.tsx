// Admin-only action: permanently delete an influencer and ALL related records.
// Posted to by app/components/admin/InfluencerManagement.tsx's fetcher.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const form = await request.formData();
  const influencerId = form.get("influencerId");

  if (typeof influencerId !== "string" || !influencerId) {
    return json({ ok: false, error: "Missing influencerId" }, { status: 400 });
  }

  const existing = await prisma.influencer.findUnique({ where: { id: influencerId } });
  if (!existing) {
    return json({ ok: false, error: "Influencer not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction([
      prisma.commission.deleteMany({ where: { influencerId } }),
      prisma.click.deleteMany({ where: { influencerId } }),
      prisma.order.deleteMany({ where: { influencerId } }),
      prisma.payout.deleteMany({ where: { influencerId } }),
      prisma.referral.deleteMany({ where: { influencerId } }),
      prisma.referralLink.deleteMany({ where: { influencerId } }),
      prisma.reward.deleteMany({ where: { influencerId } }),
      prisma.discountCode.deleteMany({ where: { influencerId } }),
      prisma.bankDetail.deleteMany({ where: { influencerId } }),
      prisma.notification.deleteMany({ where: { influencerId } }),
      prisma.commissionRule.deleteMany({ where: { influencerId } }),
      prisma.influencer.delete({ where: { id: influencerId } }),
    ]);
  } catch (err) {
    return json({ ok: false, error: "Delete failed: " + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }

  return json({ ok: true, deleted: influencerId });
}
