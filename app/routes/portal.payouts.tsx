import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

  const payouts = await prisma.payout.findMany({
    where: { influencerId: influencer.id },
    orderBy: { id: "desc" },
  });

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      status: p.status,
      processedAt: p.processedAt,
    })),
  });
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#B45309",
  processing: "#1D4ED8",
  completed: "#15803D",
  failed: "#B91C1C",
};

export default function PortalPayouts() {
  const { influencerName, payouts } = useLoaderData<typeof loader>();

  return (
    <PortalShell influencerName={influencerName}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "1rem" }}>Payout history</h1>
      <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F9FC", textAlign: "left" }}>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Amount</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Method</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Status</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#777" }}>Processed</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.currency} {p.amount}</td>
                <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{p.method.replace("_", " ")}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: STATUS_COLOR[p.status] ?? "#333", fontWeight: 600, textTransform: "capitalize" }}>{p.status}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>{p.processedAt ? new Date(p.processedAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1.5rem 16px", color: "#777" }}>No payouts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
