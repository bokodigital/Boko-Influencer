import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

  const commissions = await prisma.commission.findMany({
    where: { influencerId: influencer.id },
    orderBy: { id: "desc" },
    take: 100,
    include: { order: { select: { shopifyOrderId: true, orderTotal: true } } },
  });

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    commissions: commissions.map((c) => ({
      id: c.id,
      orderTotal: c.order ? c.order.orderTotal.toString() : null,
      amount: c.amount.toString(),
      status: c.status,
      approvedAt: c.approvedAt,
      paidAt: c.paidAt,
    })),
  });
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#B45309",
  approved: "#1D4ED8",
  paid: "#15803D",
  reversed: "#B91C1C",
};

export default function PortalCommissions() {
  const { influencerName, commissions } = useLoaderData<typeof loader>();

  return (
    <PortalShell influencerName={influencerName}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "1rem" }}>Commissions</h1>
      <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F9FC", textAlign: "left" }}>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Order total</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Commission</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Status</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>{c.orderTotal ? `$${c.orderTotal} AUD` : "—"}</td>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>${c.amount} AUD</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: STATUS_COLOR[c.status] ?? "#333", fontWeight: 600, textTransform: "capitalize" }}>{c.status}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>{c.paidAt ? new Date(c.paidAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1.5rem 16px", color: "#777" }}>No commissions yet — share your referral link to start earning.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
