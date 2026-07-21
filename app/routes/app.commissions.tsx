import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  Button,
  FormLayout,
  TextField,
  Select,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { approveEligiblePendingCommissions } from "../lib/commission.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

const STATUS_TONE: Record<string, "success" | "attention" | "critical" | "info"> = {
  approved: "success",
  pending: "attention",
  reversed: "critical",
  paid: "info",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const [commissions, globalRule, overrides, influencers] = await Promise.all([
    prisma.commission.findMany({
      where: { influencer: { shop: session.shop } },
      orderBy: { id: "desc" },
      take: 100,
      include: {
        influencer: { select: { firstName: true, lastName: true } },
        order: { select: { shopifyOrderId: true, currency: true } },
      },
    }),
    prisma.commissionRule.findFirst({ where: { influencerId: null, active: true } }),
    prisma.commissionRule.findMany({
      where: { influencerId: { not: null }, active: true, influencer: { shop: session.shop } },
      include: { influencer: { select: { firstName: true, lastName: true } } },
    }),
    prisma.influencer.findMany({
      where: { status: "approved", shop: session.shop },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return json({
    commissions: commissions.map((c) => ({
      id: c.id,
      influencerName: c.influencer.firstName + " " + c.influencer.lastName,
      orderId: c.order.shopifyOrderId,
      amount: c.amount.toString(),
      currency: c.order.currency,
      status: c.status,
    })),
    globalRule: globalRule
      ? { id: globalRule.id, type: globalRule.type, value: globalRule.value.toString(), appliesTo: globalRule.appliesTo }
      : null,
    overrides: overrides.map((o) => ({
      id: o.id,
      influencerName: o.influencer ? o.influencer.firstName + " " + o.influencer.lastName : "Unknown",
      type: o.type,
      value: o.value.toString(),
    })),
    influencers,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "approve_eligible") {
    const count = await approveEligiblePendingCommissions();
    return json({ ok: true, approvedCount: count });
  }

  if (intent === "set_global_rule") {
    const type = String(form.get("type") || "percentage");
    const value = Number(form.get("value") || 0);
    await prisma.commissionRule.updateMany({ where: { influencerId: null }, data: { active: false } });
    await prisma.commissionRule.create({
      data: { influencerId: null, type: type as any, value, appliesTo: "total_after_discount", active: true },
    });
    return json({ ok: true });
  }

  if (intent === "add_override") {
    const influencerId = String(form.get("influencerId") || "");
    const type = String(form.get("type") || "percentage");
    const value = Number(form.get("value") || 0);
    if (!influencerId) return json({ error: "Select an influencer." }, { status: 400 });
    await prisma.commissionRule.create({
      data: { influencerId, type: type as any, value, appliesTo: "total_after_discount", active: true },
    });
    return json({ ok: true });
  }

  if (intent === "approve_commission") {
    const commissionId = String(form.get("commissionId") || "");
    await prisma.commission.updateMany({ where: { id: commissionId, influencer: { shop: session.shop } }, data: { status: "approved" } });
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AppCommissions() {
  const { commissions, globalRule, overrides, influencers } = useLoaderData<typeof loader>();
  const ruleFetcher = useFetcher();
  const overrideFetcher = useFetcher();
  const approveOneFetcher = useFetcher();
  const approveFetcher = useFetcher<{ ok?: boolean; approvedCount?: number }>();

  const [globalType, setGlobalType] = useState(globalRule?.type || "percentage");
  const [globalValue, setGlobalValue] = useState(globalRule?.value || "10");

  const [overrideInfluencer, setOverrideInfluencer] = useState(influencers[0]?.id || "");
  const [overrideType, setOverrideType] = useState("percentage");
  const [overrideValue, setOverrideValue] = useState("10");

  const rows = commissions.map((c, index) => (
    <IndexTable.Row id={String(c.id)} key={c.id} position={index}>
      <IndexTable.Cell>{c.influencerName}</IndexTable.Cell>
      <IndexTable.Cell>#{c.orderId}</IndexTable.Cell>
      <IndexTable.Cell>
        {c.currency} {Number(c.amount).toFixed(2)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center"><Badge tone={STATUS_TONE[c.status] ?? "info"}>{c.status}</Badge>{c.status === "pending" && (<approveOneFetcher.Form method="post"><input type="hidden" name="intent" value="approve_commission" /><input type="hidden" name="commissionId" value={c.id} /><Button submit size="slim" variant="primary">Approve</Button></approveOneFetcher.Form>)}</InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Commissions">
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Commissions" subtitle="Track influencer earnings and approval status." />
            <HowToUse title="Instructions for the Commissions module"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Each order using a referral code creates a commission, starting as Pending.</li><li>Click Approve to confirm a commission, or wait out your refund window.</li><li>Approved commissions become payable and appear on the Payouts page.</li><li>Amounts are calculated automatically from each influencer commission rate.</li></ul></HowToUse>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingSm">
                    Global commission rule
                  </Text>
                  <Button
                    size="slim"
                    loading={approveFetcher.state !== "idle"}
                    onClick={() => approveFetcher.submit({ intent: "approve_eligible" }, { method: "post" })}
                  >
                    Approve eligible pending commissions
                  </Button>
                </InlineStack>
                {approveFetcher.data?.ok && (
                  <Text as="p" tone="success">
                    Approved {approveFetcher.data.approvedCount} commission(s) past the refund holdback window.
                  </Text>
                )}
                <ruleFetcher.Form method="post">
                  <input type="hidden" name="intent" value="set_global_rule" />
                  <FormLayout>
                    <FormLayout.Group>
                      <Select
                        label="Type"
                        name="type"
                        options={[
                          { label: "Percentage", value: "percentage" },
                          { label: "Fixed amount", value: "fixed" },
                        ]}
                        value={globalType}
                        onChange={(value) => setGlobalType(value as "fixed" | "percentage")}
                      />
                      <TextField
                        label={globalType === "percentage" ? "Percentage (%)" : "Amount (AUD)"}
                        name="value"
                        type="number"
                        autoComplete="off"
                        value={String(globalValue)}
                        onChange={setGlobalValue}
                      />
                    </FormLayout.Group>
                    <Button submit loading={ruleFetcher.state !== "idle"}>
                      Save global rule
                    </Button>
                  </FormLayout>
                </ruleFetcher.Form>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Per-influencer overrides
                </Text>
                {overrides.length > 0 && (
                  <BlockStack gap="100">
                    {overrides.map((o) => (
                      <Text as="p" key={o.id}>
                        {o.influencerName}: {o.type === "percentage" ? o.value + "%" : "$" + o.value + " AUD"}
                      </Text>
                    ))}
                  </BlockStack>
                )}
                <overrideFetcher.Form method="post">
                  <input type="hidden" name="intent" value="add_override" />
                  <FormLayout>
                    <FormLayout.Group>
                      <Select
                        label="Influencer"
                        name="influencerId"
                        options={influencers.map((i) => ({
                          label: i.firstName + " " + i.lastName,
                          value: i.id,
                        }))}
                        value={overrideInfluencer}
                        onChange={setOverrideInfluencer}
                      />
                      <Select
                        label="Type"
                        name="type"
                        options={[
                          { label: "Percentage", value: "percentage" },
                          { label: "Fixed amount", value: "fixed" },
                        ]}
                        value={overrideType}
                        onChange={setOverrideType}
                      />
                      <TextField
                        label="Value"
                        name="value"
                        type="number"
                        autoComplete="off"
                        value={overrideValue}
                        onChange={setOverrideValue}
                      />
                    </FormLayout.Group>
                    <Button submit loading={overrideFetcher.state !== "idle"}>
                      Add override
                    </Button>
                  </FormLayout>
                </overrideFetcher.Form>
              </BlockStack>
            </Card>

            <Card padding="0">
              <IndexTable
                itemCount={commissions.length}
                headings={[
                  { title: "Influencer" },
                  { title: "Order" },
                  { title: "Amount" },
                  { title: "Status" },
                ]}
                selectable={false}
              >
                {rows}
              </IndexTable>
              {commissions.length === 0 && (
                <div style={{ padding: "20px 24px" }}>
                  <Text as="p">No commissions yet.</Text>
                </div>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
