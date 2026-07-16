import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import bokoStyles from "../styles/boko.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: bokoStyles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
}

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Overview</a>
        <a href="/app/influencers">Influencers</a>
        <a href="/app/commissions">Commissions</a>
        <a href="/app/payouts">Payouts</a>
        <a href="/app/discounts">Discounts</a>
        <a href="/app/rewards">Rewards</a>
        <a href="/app/settings/emails">Settings</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}
