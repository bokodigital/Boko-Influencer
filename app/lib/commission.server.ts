// Calculates commission for a newly attributed order.
// Called from the orders/create webhook handler after a Referral + Order row exist.

import { prisma } from "./db.server";
import type { CommissionBasis } from "@prisma/client";

interface OrderInput {
  orderId: string;
  influencerId: string;
  subtotal: number;
  totalAfterDiscount: number;
}

export async function calculateCommissionForOrder(input: OrderInput) {
  const rule =
    (await prisma.commissionRule.findFirst({
      where: { influencerId: input.influencerId, active: true },
    })) ??
    (await prisma.commissionRule.findFirst({
      where: { influencerId: null, active: true },
    }));

  if (!rule) {
    throw new Error(
      `No commission rule found for influencer ${input.influencerId} and no global default is configured.`
    );
  }

  const basisAmount = basisAmountFor(rule.appliesTo, input);

  if (rule.minOrderValue && basisAmount < Number(rule.minOrderValue)) {
    return null;
  }

  const amount =
    rule.type === "percentage"
      ? basisAmount * (Number(rule.value) / 100)
      : Number(rule.value);

  return prisma.commission.create({
    data: {
      orderId: input.orderId,
      influencerId: input.influencerId,
      commissionRuleId: rule.id,
      amount,
      status: "pending",
    },
  });
}

function basisAmountFor(basis: CommissionBasis, input: OrderInput): number {
  return basis === "subtotal" ? input.subtotal : input.totalAfterDiscount;
}

const REFUND_HOLDBACK_DAYS = 14;

export async function approveEligiblePendingCommissions() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REFUND_HOLDBACK_DAYS);

  const eligible = await prisma.commission.findMany({
    where: {
      status: "pending",
      order: { createdAt: { lte: cutoff }, orderStatus: { not: "refunded" } },
    },
  });

  await prisma.$transaction(
    eligible.map((c) =>
      prisma.commission.update({
        where: { id: c.id },
        data: { status: "approved", approvedAt: new Date() },
      })
    )
  );

  return eligible.length;
}

export async function reverseCommissionForOrder(shopifyOrderId: string) {
  const order = await prisma.order.findUnique({
    where: { shopifyOrderId },
    include: { commission: true },
  });
  if (!order?.commission) return null;

  return prisma.commission.update({
    where: { id: order.commission.id },
    data: { status: "reversed" },
  });
}
