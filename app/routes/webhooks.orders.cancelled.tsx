// Handles orders/cancelled webhook — reverses the linked commission
// rather than deleting it, so there is an audit trail (spec section 6.5).

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { reverseCommissionForOrder } from "../lib/commission.server";

export async function action({ request }: ActionFunctionArgs) {
  const { payload } = await authenticate.webhook(request);

  const order = payload as { id: number };

  await reverseCommissionForOrder(order.id.toString());

  return new Response(null, { status: 200 });
}
