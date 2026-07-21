import { prisma } from "./db.server";
import { notify } from "./klaviyo.server";

/**
 * unlockCondition format: "<metric>:<threshold>"
 *   metric: "referrals" (count of converted orders) | "revenue" (sum order total AUD)
 * e.g. "referrals:5" or "revenue:500"
 */
function parseCondition(condition: string): { metric: "referrals" | "revenue"; threshold: number } | null {
  const [metric, thresholdRaw] = condition.split(":").map((s) => s.trim());
  const threshold = Number(thresholdRaw);
  if ((metric !== "referrals" && metric !== "revenue") || Number.isNaN(threshold)) {
    return null;
  }
  return { metric, threshold };
}

export async function evaluateRewardUnlocks() {
  const lockedRewards = await prisma.reward.findMany({
    where: { status: "locked" },
    include: { influencer: { select: { id: true, firstName: true, lastName: true } } },
  });

  let unlockedCount = 0;

  for (const reward of lockedRewards) {
    const parsed = parseCondition(reward.unlockCondition);
    if (!parsed) continue;

    let actual = 0;
    if (parsed.metric === "referrals") {
      actual = await prisma.order.count({ where: { influencerId: reward.influencerId } });
    } else {
      const agg = await prisma.order.aggregate({
        where: { influencerId: reward.influencerId },
        _sum: { orderTotal: true },
      });
      actual = Number(agg._sum.orderTotal ?? 0);
    }

    if (actual >= parsed.threshold) {
      await prisma.reward.update({
        where: { id: reward.id },
        data: { status: "unlocked" },
      });
      await notify("Reward Unlocked", reward.influencerId, {
        rewardId: reward.id,
        reward_title: reward.title,
        reward_type: reward.type,
      });
      unlockedCount += 1;
    }
  }

  return { checked: lockedRewards.length, unlocked: unlockedCount };
}
