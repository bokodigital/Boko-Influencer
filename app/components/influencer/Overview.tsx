// Structural stub for the influencer dashboard's Overview tab.

import { useLoaderData } from "@remix-run/react";

interface OverviewData {
  totalReferrals: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  rewardTier: string | null;
  referralLink: string;
}

export default function Overview() {
  const data = useLoaderData<OverviewData>();

  return (
    <section>
      <h1>Overview</h1>

      <div className="stat-grid">
        <StatCard label="Total referrals" value={data.totalReferrals} />
        <StatCard label="Total orders" value={data.totalOrders} />
        <StatCard label="Total revenue generated" value={formatMoney(data.totalRevenue)} />
        <StatCard label="Total commission earned" value={formatMoney(data.totalCommissionEarned)} />
        <StatCard label="Pending commission" value={formatMoney(data.pendingCommission)} />
        <StatCard label="Reward status" value={data.rewardTier ?? "-"} />
      </div>

      <div className="referral-link-box">
        <p>Your referral link</p>
        <code>{data.referralLink}</code>
        <button onClick={() => navigator.clipboard.writeText(data.referralLink)}>
          Copy
        </button>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
