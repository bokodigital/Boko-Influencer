import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import bokoStyles from "../styles/boko.css?url";
import { authenticate, registerWebhooks } from "../shopify.server";
import { prisma } from "../lib/db.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: bokoStyles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  // Safety net: make sure Shopify has our order/uninstall webhook
  // subscriptions registered for this shop. This runs on every admin
  // page load, but registerWebhooks() is idempotent (it just confirms
  // the subscriptions already match), so the extra call is cheap. This
  // guarantees commissions start flowing even for shops that connected
  // before webhook registration was wired into the auth flow.
  try {
    await registerWebhooks({ session });
  } catch (error) {
    console.error("Failed to register webhooks", error);
  }

  // Which optional modules are enabled for this shop. Defaults to all-on and
  // never throws — if the settings columns aren't present yet the nav simply
  // shows every module.
  let modules = { commissions: true, payouts: true, discounts: true, rewards: true };
  try {
    const settings = await prisma.shopSettings.findUnique({
      where: { shop: session.shop },
      select: { moduleCommissions: true, modulePayouts: true, moduleDiscounts: true, moduleRewards: true },
    });
    if (settings) {
      modules = {
        commissions: settings.moduleCommissions,
        payouts: settings.modulePayouts,
        discounts: settings.moduleDiscounts,
        rewards: settings.moduleRewards,
      };
    }
  } catch (error) {
    console.error("Failed to load module settings", error);
  }

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "", modules });
}

export default function AppLayout() {
  const { apiKey, modules } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Overview</a>
        <a href="/app/influencers">Influencers</a>
        {modules.commissions ? <a href="/app/commissions">Commissions</a> : null}
        {modules.payouts ? <a href="/app/payouts">Payouts</a> : null}
        {modules.discounts ? <a href="/app/discounts">Discounts</a> : null}
        {modules.rewards ? <a href="/app/rewards">Rewards</a> : null}
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}
