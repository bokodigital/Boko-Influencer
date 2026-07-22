import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack, InlineGrid, DataTable } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    influencerCount,
    pendingCount,
    activeCount,
    commissionAgg,
    payoutAgg,
    clicksCount,
    orderAgg,
    influencers,
  ] = await Promise.all([
    prisma.influencer.count({ where: { shop } }),
    prisma.influencer.count({ where: { status: "pending", shop } }),
    prisma.influencer.count({ where: { status: "approved", shop } }),
    prisma.commission.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["pending", "approved"] }, influencer: { shop } },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
      where: { status: "completed", influencer: { shop } },
    }),
    prisma.click.count({ where: { influencer: { shop } } }),
    prisma.order.aggregate({
      _sum: { orderTotal: true },
      _count: { _all: true },
      where: { influencer: { shop } },
    }),
    prisma.influencer.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        referralCode: true,
        status: true,
        _count: { select: { clicks: true, orders: true } },
        orders: { select: { orderTotal: true } },
        commissions: { select: { amount: true, status: true } },
      },
    }),
  ]);

  const rows = influencers.map((inf) => {
    const revenue = inf.orders.reduce((sum, o) => sum + Number(o.orderTotal), 0);
    const owed = inf.commissions
      .filter((c) => c.status === "pending" || c.status === "approved")
      .reduce((sum, c) => sum + Number(c.amount), 0);
    return {
      id: inf.id,
      name: `${inf.firstName} ${inf.lastName}`.trim(),
      code: inf.referralCode,
      status: inf.status,
      clicks: inf._count.clicks,
      purchases: inf._count.orders,
      revenue,
      owed,
    };
  });

  return json({
    influencerCount,
    pendingCount,
    activeCount,
    clicksCount,
    purchasesCount: orderAgg._count._all,
    revenueTotal: Number(orderAgg._sum.orderTotal || 0),
    owedTotal: Number(commissionAgg._sum.amount || 0),
    paidTotal: Number(payoutAgg._sum.amount || 0),
    rows,
  });
}

function money(n: number) {
  return "$" + n.toFixed(2) + " AUD";
}

export default function AppIndex() {
  const {
    influencerCount,
    pendingCount,
    activeCount,
    clicksCount,
    purchasesCount,
    revenueTotal,
    owedTotal,
    paidTotal,
    rows,
  } = useLoaderData<typeof loader>();

  const metrics: { label: string; value: string; caption?: string }[] = [
    { label: "Clicks", value: String(clicksCount) },
    { label: "Add to cart", value: "N/A" },
    { label: "Purchases", value: String(purchasesCount) },
    { label: "Revenue", value: money(revenueTotal) },
    { label: "Active influencers", value: String(activeCount) },
    { label: "Total influencers", value: String(influencerCount), caption: pendingCount + " pending review" },
    { label: "Owed in commissions", value: money(owedTotal) },
    { label: "Paid out", value: money(paidTotal) },
  ];

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner
              title="Influencer marketing dashboard"
              subtitle="Track referrals, approve influencers, and manage commission payouts."
            />
            <HowToUse title="Instructions for the Dashboard module"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Influencers: add people manually or approve applicants who registered through your public link (they show as Pending).</li><li>Commissions: review and approve the commission earned on each referred order.</li><li>Payouts: pay approved commissions via PayPal or Stripe.</li><li>Discounts: create the referral codes influencers share.</li><li>Rewards: set milestone bonuses that unlock automatically.</li><li>Typical flow: approve an influencer, share their referral link, then approve and pay their commissions.</li></ul></HowToUse>
            <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
              {metrics.map((m) => (
                <Card key={m.label}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {m.label}
                    </Text>
                    <Text as="p" variant="headingLg">
                      {m.value}
                    </Text>
                    {m.caption ? (
                      <Text as="p" variant="bodySm" tone="subdued">
                        {m.caption}
                      </Text>
                    ) : null}
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Influencer performance
                </Text>
                {rows.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No influencers yet. Add one from the Influencers page or share your registration link.
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "numeric"]}
                    headings={["Influencer", "Code", "Clicks", "Purchases", "Revenue", "Owed"]}
                    rows={rows.map((r) => [
                      <Link key={r.id} to={`/app/influencers/${r.id}`}>{r.name}</Link>,
                      r.code,
                      r.clicks,
                      r.purchases,
                      money(r.revenue),
                      money(r.owed),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
