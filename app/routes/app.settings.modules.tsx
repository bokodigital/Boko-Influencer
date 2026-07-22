import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Card, Text, BlockStack, Checkbox, Button, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  let modules = { commissions: true, payouts: true, discounts: true, rewards: true };
  try {
    const s = await prisma.shopSettings.findUnique({
      where: { shop: session.shop },
      select: { moduleCommissions: true, modulePayouts: true, moduleDiscounts: true, moduleRewards: true },
    });
    if (s) {
      modules = {
        commissions: s.moduleCommissions,
        payouts: s.modulePayouts,
        discounts: s.moduleDiscounts,
        rewards: s.moduleRewards,
      };
    }
  } catch (error) {
    console.error("Failed to load module settings", error);
  }
  return json({ modules });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const val = (k: string) => form.get(k) === "true";
  const data = {
    moduleCommissions: val("commissions"),
    modulePayouts: val("payouts"),
    moduleDiscounts: val("discounts"),
    moduleRewards: val("rewards"),
  };
  await prisma.shopSettings.upsert({ where: { shop }, update: data, create: { shop, ...data } });
  return json({ ok: true });
}

export default function ModulesSettings() {
  const { modules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean }>();
  const [commissions, setCommissions] = useState(modules.commissions);
  const [payouts, setPayouts] = useState(modules.payouts);
  const [discounts, setDiscounts] = useState(modules.discounts);
  const [rewards, setRewards] = useState(modules.rewards);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Modules" subtitle="Turn program modules on or off. Disabled modules are hidden from your navigation." />
            <HowToUse title="Instructions for the Modules settings"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Tick a module to keep it on, untick it to hide it.</li><li>Influencers and Settings are always available.</li><li>Save, then reload the app for the navigation to update.</li><li>Turning a module off only hides it — your existing data is kept.</li></ul></HowToUse>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Program modules</Text>
                <Checkbox label="Commissions" checked={commissions} onChange={setCommissions} helpText="Track and approve commission earned on referred orders." />
                <Checkbox label="Payouts" checked={payouts} onChange={setPayouts} helpText="Pay approved commissions via PayPal or Stripe." />
                <Checkbox label="Discounts" checked={discounts} onChange={setDiscounts} helpText="Create the referral discount codes influencers share." />
                <Checkbox label="Rewards" checked={rewards} onChange={setRewards} helpText="Milestone rewards that unlock a discount code automatically." />
                <fetcher.Form method="post">
                  <input type="hidden" name="commissions" value={String(commissions)} />
                  <input type="hidden" name="payouts" value={String(payouts)} />
                  <input type="hidden" name="discounts" value={String(discounts)} />
                  <input type="hidden" name="rewards" value={String(rewards)} />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button url="/app/settings">Back to settings</Button>
                    <Button submit variant="primary" loading={fetcher.state !== "idle"}>Save</Button>
                  </InlineStack>
                </fetcher.Form>
                {fetcher.data?.ok ? (
                  <Text as="p" tone="success">Saved. Reload the app to see the navigation update.</Text>
                ) : null}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
