import { prisma } from "./db.server";
import { notify } from "./klaviyo.server";
import { unauthenticated } from "../shopify.server";

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

const CREATE_DISCOUNT_MUTATION = `#graphql
  mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Creates the influencer's reward discount code in Shopify at the moment the
 * reward unlocks. Start date = now (the moment they hit the threshold),
 * end date = the end date configured on the reward. Also stores a local
 * DiscountCode row so future orders using the code are attributed correctly.
 */
async function createRewardDiscount(reward: {
  id: string;
  influencerId: string;
  discountCode: string;
  discountKind: string;
  value: unknown;
  endsAt: Date | null;
  influencer: { firstName: string; lastName: string; shop: string | null };
}) {
  const shop = reward.influencer.shop;
  if (!shop) return;

  const value = Number(reward.value ?? 0);
  const { admin } = await unauthenticated.admin(shop);

  const response = await admin.graphql(CREATE_DISCOUNT_MUTATION, {
    variables: {
      basicCodeDiscount: {
        title: `${reward.influencer.firstName} ${reward.influencer.lastName} - ${reward.discountCode}`,
        code: reward.discountCode,
        startsAt: new Date().toISOString(),
        endsAt: reward.endsAt ? new Date(reward.endsAt).toISOString() : null,
        customerSelection: { all: true },
        customerGets: {
          value:
            reward.discountKind === "percentage"
              ? { percentage: value / 100 }
              : { discountAmount: { amount: value, appliesOnEachItem: false } },
          items: { all: true },
        },
      },
    },
  });

  const result = await response.json();
  const userErrors = result.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return;
  }

  const shopifyDiscountId = result.data.discountCodeBasicCreate.codeDiscountNode.id;

  await prisma.discountCode.create({
    data: {
      influencerId: reward.influencerId,
      code: reward.discountCode,
      type: reward.discountKind === "percentage" ? "percentage" : "fixed",
      value,
      shopifyDiscountId,
      expiresAt: reward.endsAt ? new Date(reward.endsAt) : null,
      active: true,
    },
  });

  await prisma.reward.update({
    where: { id: reward.id },
    data: { shopifyDiscountId },
  });

  await notify("Discount Code Created", reward.influencerId, { code: reward.discountCode });
}

export async function evaluateRewardUnlocks() {
  const lockedRewards = await prisma.reward.findMany({
    where: { status: "locked" },
    include: { influencer: { select: { id: true, firstName: true, lastName: true, shop: true } } },
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

      // Auto-create the Shopify discount code the moment the reward unlocks.
      if (reward.discountCode && reward.discountKind && !reward.shopifyDiscountId) {
        try {
          await createRewardDiscount({
            id: reward.id,
            influencerId: reward.influencerId,
            discountCode: reward.discountCode,
            discountKind: reward.discountKind,
            value: reward.value,
            endsAt: reward.endsAt ?? null,
            influencer: reward.influencer,
          });
        } catch (e) {
          // Non-fatal: the reward is still unlocked and the code can be retried.
        }
      }

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
