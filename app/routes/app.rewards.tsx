import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Card, IndexTable, Badge, Text, Button, BlockStack, FormLayout, Select, TextField, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { evaluateRewardUnlocks } from "../lib/rewards.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const rewards = await prisma.reward.findMany({
    where: { influencer: { shop: session.shop } },
    orderBy: { id: "desc" },
    take: 100,
    include: { influencer: { select: { firstName: true, lastName: true } } },
  });

  const influencers = await prisma.influencer.findMany({
    where: { status: "approved", shop: session.shop },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  return json({
    rewards: rewards.map((r) => ({
      id: r.id,
      influencerName: `${r.influencer.firstName} ${r.influencer.lastName}`,
      type: r.type,
      title: r.title,
      description: r.description,
      value: r.value ? r.value.toString() : null,
      status: r.status,
      unlockCondition: r.unlockCondition,
    })),
    influencers,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_reward") {
    await prisma.reward.create({
      data: {
        influencerId: String(formData.get("influencerId")),
        type: String(formData.get("type")) as any,
        title: String(formData.get("title")),
        description: String(formData.get("description") || "") || null,
        value: formData.get("value") ? Number(formData.get("value")) : null,
        unlockCondition: String(formData.get("unlockCondition")),
        status: "locked",
      },
    });
    return json({ ok: true });
  }

  if (intent === "run_engine") {
    const result = await evaluateRewardUnlocks();
    return json({ ok: true, ...result });
  }

  if (intent === "redeem") {
    const rewardId = String(formData.get("rewardId"));
    await prisma.reward.update({ where: { id: rewardId }, data: { status: "redeemed" } });
    return json({ ok: true });
  }

  if (intent === "unlock_manual") {
    const rewardId = String(formData.get("rewardId"));
    await prisma.reward.update({ where: { id: rewardId }, data: { status: "unlocked" } });
    return json({ ok: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

const STATUS_TONE: Record<string, "success" | "attention" | "info"> = {
  locked: "attention",
  unlocked: "info",
  redeemed: "success",
};

export default function AppRewards() {
  const { rewards, influencers } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher();
  const engineFetcher = useFetcher<{ checked?: number; unlocked?: number }>();
  const actionFetcher = useFetcher();

  const [influencerId, setInfluencerId] = useState(influencers[0]?.id ?? "");
  const [type, setType] = useState<"bonus" | "discount_code" | "store_credit" | "tier_upgrade">("bonus");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [metric, setMetric] = useState<"referrals" | "revenue">("referrals");
  const [threshold, setThreshold] = useState("5");

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Rewards" subtitle="Set up milestone rewards and unlock them automatically as influencers hit targets." />
            <HowToUse title="How to use this page">Set milestone rewards to keep influencers motivated. Define a target, such as a number of referred orders or total sales, and the bonus unlocked when they reach it. Rewards are evaluated automatically as orders come in, and unlocked rewards appear on the influencer portal so they can track their progress.</HowToUse>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Reward engine</Text>
                <engineFetcher.Form method="post">
                  <input type="hidden" name="intent" value="run_engine" />
                  <Button submit loading={engineFetcher.state !== "idle"}>Check for unlocks</Button>
                </engineFetcher.Form>
              </InlineStack>
                {engineFetcher.data && (
                  <Text as="p">
                    Checked {engineFetcher.data.checked} locked reward(s) — unlocked {engineFetcher.data.unlocked}.
                  </Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Create reward</Text>
              <createFetcher.Form method="post">
                <input type="hidden" name="intent" value="create_reward" />
                <input type="hidden" name="unlockCondition" value={`${metric}:${threshold}`} />
                <FormLayout>
                  <FormLayout.Group>
                    <Select
                      label="Influencer"
                      name="influencerId"
                      options={influencers.map((i) => ({ label: `${i.firstName} ${i.lastName}`, value: i.id }))}
                      value={influencerId}
                      onChange={setInfluencerId}
                    />
                    <Select
                      label="Reward type"
                      name="type"
                      options={[
                        { label: "Bonus", value: "bonus" },
                        { label: "Discount code", value: "discount_code" },
                        { label: "Store credit", value: "store_credit" },
                        { label: "Tier upgrade", value: "tier_upgrade" },
                      ]}
                      value={type}
                      onChange={(v) => setType(v as typeof type)}
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Title" name="title" value={title} onChange={setTitle} autoComplete="off" />
                    <TextField label="Value (optional, AUD)" name="value" type="number" value={value} onChange={setValue} autoComplete="off" />
                  </FormLayout.Group>
                  <TextField label="Description (optional)" name="description" value={description} onChange={setDescription} autoComplete="off" multiline={2} />
                  <FormLayout.Group>
                    <Select
                      label="Unlock metric"
                      options={[
                        { label: "Referrals (converted orders)", value: "referrals" },
                        { label: "Revenue generated (AUD)", value: "revenue" },
                      ]}
                      value={metric}
                      onChange={(v) => setMetric(v as typeof metric)}
                    />
                    <TextField label="Threshold" type="number" value={threshold} onChange={setThreshold} autoComplete="off" />
                  </FormLayout.Group>
                  <Button submit variant="primary" disabled={!influencerId || !title}>Create reward</Button>
                </FormLayout>
              </createFetcher.Form>
              </BlockStack>
            </Card>

            <Card padding="0">
              <IndexTable
              itemCount={rewards.length}
              headings={[
                { title: "Influencer" },
                { title: "Reward" },
                { title: "Unlock condition" },
                { title: "Status" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rewards.map((r, index) => (
                <IndexTable.Row id={r.id} key={r.id} position={index}>
                  <IndexTable.Cell>{r.influencerName}</IndexTable.Cell>
                  <IndexTable.Cell>{r.title}{r.value ? ` ($${r.value})` : ""}</IndexTable.Cell>
                  <IndexTable.Cell>{r.unlockCondition}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={STATUS_TONE[r.status] ?? "info"}>{r.status}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      {r.status === "locked" && (
                        <actionFetcher.Form method="post">
                          <input type="hidden" name="intent" value="unlock_manual" />
                          <input type="hidden" name="rewardId" value={r.id} />
                          <Button submit size="slim">Unlock manually</Button>
                        </actionFetcher.Form>
                      )}
                      {r.status === "unlocked" && (
                        <actionFetcher.Form method="post">
                          <input type="hidden" name="intent" value="redeem" />
                          <input type="hidden" name="rewardId" value={r.id} />
                          <Button submit size="slim" variant="primary">Mark redeemed</Button>
                        </actionFetcher.Form>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {rewards.length === 0 && (
              <div style={{ padding: "20px 24px" }}>
                <Text as="p">No rewards yet.</Text>
              </div>
            )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
