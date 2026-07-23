import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Card, IndexTable, Badge, Text, Button, BlockStack, FormLayout, Select, TextField, InlineStack, Tooltip } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
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
      title: r.title,
      value: r.value ? r.value.toString() : null,
      status: r.status,
      unlockCondition: r.unlockCondition,
      discountCode: r.discountCode,
      discountKind: r.discountKind,
      endsAt: r.endsAt ? r.endsAt.toISOString().slice(0, 10) : null,
    })),
    influencers,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_reward") {
    const endsAtRaw = String(formData.get("endsAt") || "");
    await prisma.reward.create({
      data: {
        influencerId: String(formData.get("influencerId")),
        type: "discount_code" as any,
        title: String(formData.get("title")),
        description: String(formData.get("description") || "") || null,
        value: formData.get("value") ? Number(formData.get("value")) : null,
        unlockCondition: String(formData.get("unlockCondition")),
        status: "locked",
        discountCode: String(formData.get("discountCode") || "") || null,
        discountKind: String(formData.get("discountKind") || "") || null,
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      },
    });
    return json({ ok: true });
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
  const actionFetcher = useFetcher();

  const [influencerId, setInfluencerId] = useState(influencers[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountKind, setDiscountKind] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [metric, setMetric] = useState<"referrals" | "revenue">("referrals");
  const [threshold, setThreshold] = useState("5");

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Rewards" subtitle="Set up milestone rewards and unlock them automatically as influencers hit targets." />
            <HowToUse title="Instructions for the Rewards module"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Choose the influencer and give the reward a name.</li><li>Enter the discount code they will receive, its type (percentage or amount) and value.</li><li>Set an end date for the discount code.</li><li>Set the target that unlocks it, such as a number of referred orders or total sales.</li><li>When the influencer hits the target, the discount code is created automatically in Shopify, starting that day and ending on the date you set.</li></ul></HowToUse>

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
                    <TextField label="Reward name" name="title" value={title} onChange={setTitle} autoComplete="off" />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Discount code" name="discountCode" value={discountCode} onChange={setDiscountCode} autoComplete="off" />
                    <Select
                      label="Discount type"
                      name="discountKind"
                      options={[
                        { label: "Percentage (%)", value: "percentage" },
                        { label: "Amount (AUD)", value: "fixed" },
                      ]}
                      value={discountKind}
                      onChange={(v) => setDiscountKind(v as typeof discountKind)}
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label={discountKind === "percentage" ? "Discount value (%)" : "Discount value (AUD)"} name="value" type="number" value={value} onChange={setValue} autoComplete="off" />
                    <TextField label="Discount end date" name="endsAt" type="date" value={endsAt} onChange={setEndsAt} autoComplete="off" />
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
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <Text as="span" variant="bodyMd">{metric === "revenue" ? "Monetary amount (AUD)" : "Threshold"}</Text>
                        <Tooltip content={metric === "revenue"
                          ? "The total sales revenue (in AUD) this influencer must generate before the reward unlocks — e.g. 500 unlocks it once they've driven $500 in orders."
                          : "The number of converted referral orders this influencer must generate before the reward unlocks — e.g. 5 unlocks it after 5 orders."}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #8c9196", fontSize: "10px", lineHeight: 1, color: "#6d7175", cursor: "help", fontWeight: 600 }}>?</span>
                        </Tooltip>
                      </div>
                      <TextField
                        label={metric === "revenue" ? "Monetary amount (AUD)" : "Threshold"}
                        labelHidden
                        type="number"
                        value={threshold}
                        onChange={setThreshold}
                        autoComplete="off"
                        prefix={metric === "revenue" ? "$" : undefined}
                      />
                    </div>
                  </FormLayout.Group>
                  <Button submit variant="primary" disabled={!influencerId || !title || !discountCode || !value}>Create reward</Button>
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
                { title: "Discount code" },
                { title: "Unlock condition" },
                { title: "Status" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rewards.map((r, index) => (
                <IndexTable.Row id={r.id} key={r.id} position={index}>
                  <IndexTable.Cell>{r.influencerName}</IndexTable.Cell>
                  <IndexTable.Cell>{r.title}</IndexTable.Cell>
                  <IndexTable.Cell>
                    {r.discountCode
                      ? `${r.discountCode} (${r.discountKind === "percentage" ? r.value + "%" : "$" + r.value})`
                      : "—"}
                  </IndexTable.Cell>
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
