// Attributes a new order to an influencer, based on the discount code used
// (primary signal) or the boko_ref attribution cookie carried through
// checkout as a cart/order note attribute (fallback signal).

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { calculateCommissionForOrder } from "../lib/commission.server";
import { notify } from "../lib/klaviyo.server";
import { evaluateRewardUnlocks } from "../lib/rewards.server";

export async function action({ request }: ActionFunctionArgs) {
  const { payload, shop } = await authenticate.webhook(request);

  const order = payload as {
    id: number;
    discount_codes?: { code: string }[];
    note_attributes?: { name: string; value: string }[];
    subtotal_price: string;
    total_price: string;
    total_discounts: string;
    currency: string;
    customer?: { id: number };
    financial_status: string;
  };

  const discountCode = order.discount_codes?.[0]?.code;
  const refCookieAttr = order.note_attributes?.find(
    (a) => a.name === "boko_ref"
  )?.value;

  const influencer = discountCode
    ? await prisma.influencer.findFirst({
        where: { shop, discountCodes: { some: { code: { equals: discountCode, mode: "insensitive" }, active: true } } },
      })
    : refCookieAttr
    ? await prisma.influencer.findFirst({
        where: { shop, referralCode: refCookieAttr },
      })
    : null;

  if (!influencer) {
    return new Response(null, { status: 200 });
  }

  const referral = await prisma.referral.create({
    data: {
      influencerId: influencer.id,
      shopifyCustomerId: order.customer?.id?.toString(),
      attributionMethod: discountCode ? "code" : "cookie",
    },
  });

  const subtotal = Number(order.subtotal_price);
  const totalAfterDiscount = Number(order.total_price) - 0;

  const orderRow = await prisma.order.create({
    data: {
      shopifyOrderId: order.id.toString(),
      influencerId: influencer.id,
      referralId: referral.id,
      orderTotal: totalAfterDiscount,
      discountCodeUsed: discountCode,
      currency: order.currency,
      orderStatus: order.financial_status,
    },
  });

  const commission = await calculateCommissionForOrder({
    orderId: orderRow.id,
    influencerId: influencer.id,
    subtotal,
    totalAfterDiscount,
  });

  if (commission) {
    await evaluateRewardUnlocks();
    await notify("Commission Earned", influencer.id, {
      orderId: orderRow.id,
      amount: commission.amount,
    });
    await notify("New Order via Referral", influencer.id, {
      orderId: orderRow.id,
    });
  }

  return new Response(null, { status: 200 });
}
