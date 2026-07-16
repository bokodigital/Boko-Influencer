// Handles app/uninstalled webhook — Shopify requires apps to clean up
// their own session storage when a merchant uninstalls.

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { shop, session } = await authenticate.webhook(request);

  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  return new Response(null, { status: 200 });
}
