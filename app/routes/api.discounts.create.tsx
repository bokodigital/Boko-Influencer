// Admin-only route: creates a Shopify-native discount code for an
// influencer and stores the local DiscountCode row linked to it.

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { notify } from "../lib/klaviyo.server";

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

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const { influencerId, code, type, value, expiresAt, usageLimit } =
    await request.json();

  const influencer = await prisma.influencer.findUniqueOrThrow({
    where: { id: influencerId },
  });

  const response = await admin.graphql(CREATE_DISCOUNT_MUTATION, {
    variables: {
      basicCodeDiscount: {
        title: `${influencer.firstName} ${influencer.lastName} - ${code}`,
        code,
        startsAt: new Date().toISOString(),
        endsAt: expiresAt ?? null,
        usageLimit: usageLimit ?? null,
        customerSelection: { all: true },
        customerGets: {
          value:
            type === "percentage"
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
    return json({ ok: false, errors: userErrors }, { status: 400 });
  }

  const shopifyDiscountId =
    result.data.discountCodeBasicCreate.codeDiscountNode.id;

  const discountCode = await prisma.discountCode.create({
    data: {
      influencerId,
      code,
      type,
      value,
      shopifyDiscountId,
      usageLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
    },
  });

  await notify("Discount Code Created", influencerId, { code });

  return json({ ok: true, discountCode });
}
