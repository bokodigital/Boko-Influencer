import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import { stripeConfigured, createExpressAccount, createAccountLink } from "../lib/stripe.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);
  const url = new URL(request.url);
  const origin = url.origin;

  if (!stripeConfigured()) {
    return redirect("/portal/bank-details?stripe=unavailable");
  }

  if (url.searchParams.get("done")) {
    return redirect("/portal/bank-details?stripe=connected");
  }

  let accountId = influencer.stripeAccountId;
  if (!accountId) {
    accountId = await createExpressAccount(influencer.email || undefined);
    await prisma.influencer.update({
      where: { id: influencer.id },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await createAccountLink(
    accountId,
    origin + "/portal/stripe-connect",
    origin + "/portal/stripe-connect?done=1",
  );
  return redirect(link);
}
