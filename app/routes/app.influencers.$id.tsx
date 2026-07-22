import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Badge, BlockStack, InlineGrid, InlineStack, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";

const STATUS_TONE: Record<string, "success" | "attention" | "critical" | "info"> = {
  approved: "success",
  pending: "attention",
  rejected: "critical",
  disabled: "info",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const influencer = await prisma.influencer.findFirst({
    where: { id: params.id, shop },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      instagramHandle: true,
      tiktokHandle: true,
      audienceSize: true,
      referralCode: true,
    },
  });

  if (!influencer) {
    throw new Response("Influencer not found", { status: 404 });
  }

  const [clicks, orders, revenueAgg, commissionAgg] = await Promise.all([
    prisma.click.count({ where: { influencerId: influencer.id } }),
    prisma.order.count({ where: { influencerId: influencer.id } }),
    prisma.order.aggregate({ where: { influencerId: influencer.id }, _sum: { orderTotal: true } }),
    prisma.commission.groupBy({ by: ["status"], where: { influencerId: influencer.id }, _sum: { amount: true } }),
  ]);

  const commissionByStatus: Record<string, number> = { pending: 0, approved: 0, paid: 0, reversed: 0 };
  for (const row of commissionAgg) {
    commissionByStatus[row.status] = Number(row._sum.amount ?? 0);
  }

  const referralLink = `${process.env.SHOPIFY_APP_URL ?? "https://boko-influencer.replit.app"}/r/${influencer.referralCode}`;

  return json({
    influencer,
    clicks,
    orders,
    revenue: Number(revenueAgg._sum.orderTotal ?? 0),
    commissionByStatus,
    referralLink,
  });
}

function money(n: number) {
  return "$" + n.toFixed(2) + " AUD";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="p" variant="headingLg">{value}</Text>
      </BlockStack>
    </Card>
  );
}

export default function InfluencerDetail() {
  const { influencer, clicks, orders, revenue, commissionByStatus, referralLink } = useLoaderData<typeof loader>();
  const name = `${influencer.firstName} ${influencer.lastName}`.trim();

  const maxVal = Math.max(clicks, orders, 1);
  const funnel: { label: string; value: number | null; display: string }[] = [
    { label: "Clicks", value: clicks, display: String(clicks) },
    { label: "Purchases", value: orders, display: String(orders) },
  ];

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title={name} subtitle="Individual influencer performance and referral funnel." />

            <InlineStack gap="200" blockAlign="center">
              <Button url="/app">← Back to dashboard</Button>
              <Badge tone={STATUS_TONE[influencer.status] ?? "info"}>{influencer.status}</Badge>
            </InlineStack>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Details</Text>
                <Text as="p" variant="bodySm" tone="subdued">Email: {influencer.email}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Referral code: {influencer.referralCode}</Text>
                <Text as="p" variant="bodySm" tone="subdued" breakWord>Referral link: {referralLink}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Instagram: {influencer.instagramHandle || "—"}</Text>
                <Text as="p" variant="bodySm" tone="subdued">TikTok: {influencer.tiktokHandle || "—"}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Audience size: {influencer.audienceSize || "—"}</Text>
              </BlockStack>
            </Card>

            <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
              <MetricCard label="Clicks" value={String(clicks)} />
              <MetricCard label="Purchases" value={String(orders)} />
              <MetricCard label="Revenue" value={money(revenue)} />
              <MetricCard label="Owed in commissions" value={money(commissionByStatus.approved + commissionByStatus.pending)} />
            </InlineGrid>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Referral funnel</Text>
                <BlockStack gap="300">
                  {funnel.map((stage) => {
                    const pct = stage.value === null ? 0 : Math.round((stage.value / maxVal) * 100);
                    return (
                      <div key={stage.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                          <span style={{ fontWeight: 600, color: "#202223" }}>{stage.label}</span>
                          <span style={{ color: stage.value === null ? "#8c9196" : "#202223" }}>{stage.display}</span>
                        </div>
                        <div style={{ background: "#f1f2f3", borderRadius: 6, height: 22, overflow: "hidden" }}>
                          {stage.value === null ? (
                            <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 11, color: "#8c9196", fontStyle: "italic" }}>
                              Not tracked
                            </div>
                          ) : (
                            <div style={{ height: "100%", width: `${Math.max(pct, stage.value > 0 ? 4 : 0)}%`, background: "#111111", borderRadius: 6 }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </BlockStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Add-to-cart isn't tracked, so the funnel shows clicks and purchases only. Conversion:{" "}
                  {clicks > 0 ? ((orders / clicks) * 100).toFixed(1) + "% of clicks became orders" : "no clicks yet"}.
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Commission summary</Text>
                <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
                  <MetricCard label="Pending" value={money(commissionByStatus.pending)} />
                  <MetricCard label="Approved (owed)" value={money(commissionByStatus.approved)} />
                  <MetricCard label="Paid out" value={money(commissionByStatus.paid)} />
                  <MetricCard label="Reversed" value={money(commissionByStatus.reversed)} />
                </InlineGrid>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
