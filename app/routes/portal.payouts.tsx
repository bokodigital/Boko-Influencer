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

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#F8F9FC", color: "#000000" },
  processing: { bg: "#000000", color: "#BFFC00" },
  completed: { bg: "#BFFC00", color: "#000000" },
  failed: { bg: "#000000", color: "#FFFFFF" },
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
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#000000" }}>Amount</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#000000" }}>Method</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#000000" }}>Status</th>
              <th style={{ padding: "10px 16px", fontSize: "12px", color: "#000000" }}>Processed</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #000000" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{p.currency} {Number(p.amount).toFixed(2)}</td>
                <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{p.method.replace("_", " ")}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: STATUS_STYLE[p.status]?.bg ?? "#F8F9FC", color: STATUS_STYLE[p.status]?.color ?? "#000000", fontWeight: 600, textTransform: "capitalize", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", display: "inline-block" }}>{p.status}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>{p.processedAt ? new Date(p.processedAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1.5rem 16px", color: "#000000" }}>No payouts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
