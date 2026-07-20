import Stripe from "stripe";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createExpressAccount(email?: string) {
  const account = await getStripe().accounts.create({
    type: "express",
    email: email || undefined,
    business_type: "individual",
    capabilities: { transfers: { requested: true } },
  });
  return account.id;
}

export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function getAccountStatus(accountId: string) {
  const a = await getStripe().accounts.retrieve(accountId);
  return { payoutsEnabled: !!a.payouts_enabled, detailsSubmitted: !!a.details_submitted };
}

export async function sendStripeTransfer(p: { accountId: string; amount: number; currency?: string; note?: string }) {
  const t = await getStripe().transfers.create({
    amount: Math.round(p.amount * 100),
    currency: (p.currency || "AUD").toLowerCase(),
    destination: p.accountId,
    description: p.note || "Boko commission payout",
  });
  return { transferId: t.id };
}
