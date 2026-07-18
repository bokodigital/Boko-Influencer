import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { Page, Layout, Card, IndexTable, Badge, Text, Button, BlockStack, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { notify } from "../lib/klaviyo.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const payouts = await prisma.payout.findMany({
    orderBy: { id: "desc" },
    take: 100,
    include: {
      influencer: { select: { firstName: true, lastName: true } },
    },
  });

  const owedCommissions = await prisma.commission.findMany({
    where: { status: "approved", payoutId: null },
    include: {
      influencer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          bankDetails: { where: { isDefault: true }, take: 1 },
        },
      },
    },
  });

  const owedByInfluencer = new Map<string, { influencerId: string; name: string; method: string; total: number }>();
  for (const c of owedCommissions) {
    const key = c.influencer.id;
    const existing = owedByInfluencer.get(key);
    const amount = Number(c.amount);
    if (existing) {
      existing.total += amount;
    } else {
      owedByInfluencer.set(key, {
        influencerId: key,
        name: `${c.influencer.firstName} ${c.influencer.lastName}`,
        method: c.influencer.bankDetails[0]?.method ?? "other",
        total: amount,
      });
    }
  }

  return json({
    payouts: payouts.map((p) => ({
      id: p.id,
      influencerName: `${p.influencer.firstName} ${p.influencer.lastName}`,
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      status: p.status,
    })),
    owed: Array.from(owedByInfluencer.values()),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_payout") {
    const influencerId = String(formData.get("influencerId"));
    const method = String(formData.get("method") || "other");

    const commissions = await prisma.commission.findMany({
      where: { influencerId, status: "approved", payoutId: null },
    });
    if (commissions.length === 0) {
      return json({ error: "No approved commissions owed for this influencer." }, { status: 400 });
    }
    const total = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    const payout = await prisma.payout.create({
      data: {
        influencerId,
        amount: total,
        currency: "AUD",
        method: method as any,
        status: "pending",
      },
    });

    await prisma.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { payoutId: payout.id },
    });

    return json({ ok: true, payoutId: payout.id });
  }

  if (intent === "mark_processing" || intent === "mark_completed" || intent === "mark_failed") {
    const payoutId = String(formData.get("payoutId"));
    const status = intent === "mark_processing" ? "processing" : intent === "mark_completed" ? "completed" : "failed";

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: status as any,
        processedAt: status === "completed" || status === "failed" ? new Date() : undefined,
        processedBy: status === "completed" || status === "failed" ? session.shop : undefined,
      },
    });

    if (status === "completed") {
      await prisma.commission.updateMany({
        where: { payoutId },
        data: { status: "paid", paidAt: new Date() },
      });
    await notify("Payout Processed", updatedPayout.influencerId, {
      payoutId: updatedPayout.id,
      amount: updatedPayout.amount,
      method: updatedPayout.method,
    });
    }

    return json({ ok: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

const STATUS_TONE: Record<string, "success" | "attention" | "critical" | "info"> = {
  completed: "success",
  pending: "attention",
  processing: "info",
  failed: "critical",
};

export default function AppPayouts() {
  const { payouts, owed } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher();
  const statusFetcher = useFetcher();

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Payouts" subtitle="Review and process influencer payouts." />
            <HowToUse title="How to use this page">
              This is where you process payments to influencers for their approved commissions. Once a commission has cleared the refund holdback period, it becomes eligible for payout. Select approved commissions and mark them as paid once you have sent the payment through your usual payment method, such as bank transfer or PayPal.
            </HowToUse>

            <Card>
              <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Owed to influencers</Text>
              {owed.length === 0 && <Text as="p">Nothing owed right now — all approved commissions are paid out.</Text>}
              {owed.map((o) => (
                <InlineStack key={o.influencerId} align="space-between" blockAlign="center">
                  <Text as="span">{o.name} — ${o.total.toFixed(2)} AUD ({o.method})</Text>
                  <createFetcher.Form method="post">
                    <input type="hidden" name="intent" value="create_payout" />
                    <input type="hidden" name="influencerId" value={o.influencerId} />
                    <input type="hidden" name="method" value={o.method} />
                    <Button submit size="slim">Create payout</Button>
                  </createFetcher.Form>
                </InlineStack>
              ))}
            </BlockStack>
            </Card>

            <Card padding="0">
              <IndexTable
              itemCount={payouts.length}
              headings={[
                { title: "Influencer" },
                { title: "Amount" },
                { title: "Method" },
                { title: "Status" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {payouts.map((p, index) => (
                <IndexTable.Row id={p.id} key={p.id} position={index}>
                  <IndexTable.Cell>{p.influencerName}</IndexTable.Cell>
                  <IndexTable.Cell>{p.currency} {p.amount}</IndexTable.Cell>
                  <IndexTable.Cell>{p.method}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={STATUS_TONE[p.status] ?? "info"}>{p.status}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      {p.status === "pending" && (
                        <statusFetcher.Form method="post">
                          <input type="hidden" name="intent" value="mark_processing" />
                          <input type="hidden" name="payoutId" value={p.id} />
                          <Button submit size="slim">Mark processing</Button>
                        </statusFetcher.Form>
                      )}
                      {(p.status === "pending" || p.status === "processing") && (
                        <statusFetcher.Form method="post">
                          <input type="hidden" name="intent" value="mark_completed" />
                          <input type="hidden" name="payoutId" value={p.id} />
                          <Button submit size="slim" variant="primary">Mark completed</Button>
                        </statusFetcher.Form>
                      )}
                      {p.status !== "completed" && p.status !== "failed" && (
                        <statusFetcher.Form method="post">
                          <input type="hidden" name="intent" value="mark_failed" />
                          <input type="hidden" name="payoutId" value={p.id} />
                          <Button submit size="slim" tone="critical">Mark failed</Button>
                        </statusFetcher.Form>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {payouts.length === 0 && (
              <div style={{ padding: "20px 24px" }}>
                <Text as="p">No payouts yet.</Text>
              </div>
            )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
