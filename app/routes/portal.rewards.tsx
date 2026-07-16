import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

  const rewards = await prisma.reward.findMany({
    where: { influencerId: influencer.id },
    orderBy: { id: "desc" },
  });

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    rewards: rewards.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      value: r.value ? r.value.toString() : null,
      status: r.status,
      unlockCondition: r.unlockCondition,
    })),
  });
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  locked: { label: "Locked", color: "#999" },
  unlocked: { label: "Unlocked — ready to redeem", color: "#1D4ED8" },
  redeemed: { label: "Redeemed", color: "#15803D" },
};

export default function PortalRewards() {
  const { influencerName, rewards } = useLoaderData<typeof loader>();

  return (
    <PortalShell influencerName={influencerName}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "1rem" }}>Rewards</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {rewards.map((r) => {
          const meta = STATUS_LABEL[r.status] ?? { label: r.status, color: "#333" };
          return (
            <div key={r.id} style={{ background: "#fff", borderRadius: "10px", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", opacity: r.status === "locked" ? 0.7 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px" }}>{r.title}{r.value ? ` — $${r.value}` : ""}</div>
                  {r.description && <div style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>{r.description}</div>}
                </div>
                <span style={{ color: meta.color, fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>{meta.label}</span>
              </div>
              {r.status === "locked" && (
                <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>Unlocks at: {r.unlockCondition}</div>
              )}
            </div>
          );
        })}
        {rewards.length === 0 && (
          <div style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", color: "#777" }}>
            No rewards set up yet — keep referring to unlock milestone bonuses.
          </div>
        )}
      </div>
    </PortalShell>
  );
}
