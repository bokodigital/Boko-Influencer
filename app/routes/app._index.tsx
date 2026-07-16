import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack, InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const [influencerCount, pendingCount, commissionAgg, payoutAgg] = await Promise.all([
    prisma.influencer.count(),
    prisma.influencer.count({ where: { status: "pending" } }),
    prisma.commission.aggregate({ _sum: { amount: true }, where: { status: { in: ["pending", "approved"] } } }),
    prisma.payout.aggregate({ _sum: { amount: true }, where: { status: "completed" } }),
  ]);

  return json({
    influencerCount,
    pendingCount,
    owedTotal: Number(commissionAgg._sum.amount || 0),
    paidTotal: Number(payoutAgg._sum.amount || 0),
  });
}

export default function AppIndex() {
  const { influencerCount, pendingCount, owedTotal, paidTotal } = useLoaderData<typeof loader>();

  const stats = [
    { label: "Influencers", value: String(influencerCount) },
    { label: "Pending review", value: String(pendingCount) },
    { label: "Owed in commissions", value: "$" + owedTotal.toFixed(2) + " AUD" },
    { label: "Paid out", value: "$" + paidTotal.toFixed(2) + " AUD" },
  ];

  return (
    <Page title="Boko Influencer">
      <Layout>
        <Layout.Section>
          <BokoBanner
            title="Influencer marketing dashboard"
            subtitle="Track referrals, approve influencers, and manage commission payouts."
          />
          <InlineGrid columns={4} gap="400">
            {stats.map((s) => (
              <Card key={s.label}>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {s.label}
                  </Text>
                  <Text as="p" variant="headingLg">
                    {s.value}
                  </Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
