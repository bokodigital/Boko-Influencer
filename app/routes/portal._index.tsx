import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

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

  const shopSession = await prisma.session.findFirst({ select: { shop: true } });
  const shopDomain = shopSession?.shop ?? "your-store.myshopify.com";
  const referralLink = `https://${shopDomain}/?ref=${influencer.referralCode}`;

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    referralCode: influencer.referralCode,
    referralLink,
    clicks,
    orders,
    revenue: Number(revenueAgg._sum.orderTotal ?? 0),
    commissionByStatus,
  });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "10px", padding: "1.25rem", flex: 1, minWidth: "160px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: "12px", color: "#777", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function PortalOverview() {
  const data = useLoaderData<typeof loader>();

  return (
    <PortalShell influencerName={data.influencerName}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "0.25rem" }}>Welcome back, {data.influencerName.split(" ")[0]}</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>Here's how your referrals are performing.</p>

      <div style={{ background: "#000", color: "#fff", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "12px", color: "#BFFC00", marginBottom: "4px" }}>Your referral code</div>
        <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>{data.referralCode}</div>
        <div style={{ fontSize: "13px", opacity: 0.8, wordBreak: "break-all" }}>{data.referralLink}</div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <StatCard label="Link clicks" value={String(data.clicks)} />
        <StatCard label="Orders referred" value={String(data.orders)} />
        <StatCard label="Revenue generated" value={`$${data.revenue.toFixed(2)} AUD`} />
      </div>

      <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "0.75rem" }}>Commission summary</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <StatCard label="Pending" value={`$${data.commissionByStatus.pending.toFixed(2)}`} />
        <StatCard label="Approved (owed)" value={`$${data.commissionByStatus.approved.toFixed(2)}`} />
        <StatCard label="Paid out" value={`$${data.commissionByStatus.paid.toFixed(2)}`} />
      </div>
    </PortalShell>
  );
}
