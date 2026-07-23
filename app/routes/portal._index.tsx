import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import type { CSSProperties } from "react";
import { useLoaderData } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

  const [clicks, orders, revenueAgg, commissionAgg, settings] = await Promise.all([
    prisma.click.count({ where: { influencerId: influencer.id } }),
    prisma.order.count({ where: { influencerId: influencer.id } }),
    prisma.order.aggregate({ where: { influencerId: influencer.id }, _sum: { orderTotal: true } }),
    prisma.commission.groupBy({ by: ["status"], where: { influencerId: influencer.id }, _sum: { amount: true } }),
    influencer.shop
      ? prisma.shopSettings.findUnique({ where: { shop: influencer.shop }, select: { dashboardLogoUrl: true, moduleCommissions: true, modulePayouts: true } })
      : Promise.resolve(null),
  ]);

  const commissionByStatus: Record<string, number> = { pending: 0, approved: 0, paid: 0, reversed: 0 };
  for (const row of commissionAgg) {
    commissionByStatus[row.status] = Number(row._sum.amount ?? 0);
  }

  const referralLink = `${process.env.SHOPIFY_APP_URL ?? "https://boko-influencer.replit.app"}/r/${influencer.referralCode}`;

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    firstName: influencer.firstName,
    referralCode: influencer.referralCode,
    referralLink,
    clicks,
    orders,
    revenue: Number(revenueAgg._sum.orderTotal ?? 0),
    commissionByStatus,
    logoUrl: settings?.dashboardLogoUrl ?? null,
    commissionsEnabled: settings?.moduleCommissions ?? true,
    payoutsEnabled: settings?.modulePayouts ?? true,
  });
}

const cardStyle: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #ECECEC",
  borderRadius: "16px",
  padding: "1.25rem 1.5rem",
};

const sectionHeading: CSSProperties = {
  fontSize: "18px",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.01em",
  margin: "0 0 1rem",
  color: "#000000",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: "180px" }}>
      <div style={{ fontSize: "13px", color: "#6B6B6B", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 600, color: "#000000" }}>{value}</div>
    </div>
  );
}

export default function PortalOverview() {
  const data = useLoaderData<typeof loader>();
  const showSummary = data.commissionsEnabled || data.payoutsEnabled;

  return (
    <PortalShell influencerName={data.influencerName}>
      {data.logoUrl ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <img
            src={data.logoUrl}
            alt="Store logo"
            style={{ maxHeight: "48px", maxWidth: "200px", objectFit: "contain", display: "block" }}
          />
        </div>
      ) : null}

      <h1 style={{ fontSize: "32px", fontWeight: 600, margin: "0 0 0.5rem", color: "#000000" }}>
        Welcome back, {data.firstName}
      </h1>
      <p style={{ fontSize: "14px", color: "#272727", margin: "0 0 2rem", lineHeight: 1.6, maxWidth: "560px" }}>
        Share your code to start earning. Every click and order you generate is tracked here in real time.
      </p>

      {/* Referral code — single dark band (compact) */}
      <div style={{ background: "#000000", color: "#FFFFFF", borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1.5rem", maxWidth: "520px" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#CFCFCF", marginBottom: "6px" }}>
          Your code
        </div>
        <div style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "0.02em", marginBottom: "6px" }}>
          {data.referralCode}
        </div>
        <div style={{ fontSize: "12px", color: "#BDBDBD", wordBreak: "break-all" }}>{data.referralLink}</div>
      </div>

      {/* How to use */}
      <div style={{ ...cardStyle, marginBottom: "2rem" }}>
        <h2 style={sectionHeading}>How to use your code</h2>
        <ol style={{ margin: 0, paddingLeft: "1.25rem", color: "#272727", fontSize: "14px", lineHeight: 1.9 }}>
          <li><strong>Share your link.</strong> Post {data.referralLink} anywhere you like — anyone who clicks it and buys is automatically tracked to you, no code needed.</li>
          <li><strong>Or share your code {data.referralCode}.</strong> Customers can enter it at checkout — every order placed with your code is credited to you.</li>
          <li><strong>Watch it add up.</strong> Your clicks, orders{data.commissionsEnabled ? " and commissions" : ""} update on this page in real time.</li>
        </ol>
      </div>

      <h2 style={sectionHeading}>Your performance</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: showSummary ? "2rem" : "0" }}>
        <StatCard label="Link clicks" value={String(data.clicks)} />
        <StatCard label="Orders referred" value={String(data.orders)} />
        <StatCard label="Revenue generated" value={`$${data.revenue.toFixed(2)} AUD`} />
      </div>

      {showSummary ? (
        <>
          <h2 style={sectionHeading}>Commission summary</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {data.commissionsEnabled ? <StatCard label="Pending" value={`$${data.commissionByStatus.pending.toFixed(2)}`} /> : null}
            {data.commissionsEnabled ? <StatCard label="Approved (owed)" value={`$${data.commissionByStatus.approved.toFixed(2)}`} /> : null}
            {data.payoutsEnabled ? <StatCard label="Paid out" value={`$${data.commissionByStatus.paid.toFixed(2)}`} /> : null}
          </div>
        </>
      ) : null}
    </PortalShell>
  );
}
