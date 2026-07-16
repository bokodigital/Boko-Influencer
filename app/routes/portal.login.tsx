import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { prisma } from "../lib/db.server";
import { createMagicLinkToken } from "../lib/portal-auth.server";
import { notify } from "../lib/klaviyo.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  const influencer = await prisma.influencer.findUnique({ where: { email } });

  if (!influencer || influencer.status !== "approved") {
    return json({
      sent: true,
      message: "If that email matches an approved influencer account, a login link has been generated.",
    });
  }

  const token = createMagicLinkToken(influencer.id);
  const url = new URL(request.url);
  const link = `${url.origin}/portal/auth/${token}`;

  await notify("Portal Login Link", influencer.id, { link });
  // TODO: remove the fallback below once Klaviyo delivery is confirmed live.
  // For now it is surfaced directly so the portal is usable end-to-end.
  return json({ sent: true, link, message: "Login link generated (valid for 15 minutes)." });
}

export default function PortalLogin() {
  const fetcher = useFetcher<{ sent?: boolean; link?: string; message?: string }>();

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ background: "#FFFFFF", padding: "2.5rem", borderRadius: "12px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
          <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="2176 -2073.2 4652.3 4447.2" xmlns="http://www.w3.org/2000/svg">
              <path d="M3916.2,1378.9c-20.7,0-41.4-1-61.6-2.9L6548-1312.1l-580.3-579.1L3274.4,796.9c-2-20.3-2.9-40.8-2.9-61.5v-2632.7h-820.7V735.5c0,807.8,655.9,1462.6,1465.2,1462.6h2637.6V1379H3916.2V1378.9z" fill="#000000" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Boko Influencer Portal</div>
            <div style={{ fontSize: "13px", color: "#000000" }}>Sign in to view your dashboard</div>
          </div>
        </div>

        {!fetcher.data?.sent && (
          <fetcher.Form method="post">
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Email address</label>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #000000", borderRadius: "8px", marginBottom: "1rem", boxSizing: "border-box" }}
            />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              style={{ width: "100%", padding: "12px", background: "#BFFC00", color: "#000", fontWeight: 700, border: "none", borderRadius: "8px", cursor: "pointer" }}
            >
              {fetcher.state !== "idle" ? "Sending..." : "Send login link"}
            </button>
          </fetcher.Form>
        )}

        {fetcher.data?.sent && (
          <div>
            <p style={{ fontSize: "14px", color: "#000000" }}>{fetcher.data.message}</p>
            {fetcher.data.link && (
              <a href={fetcher.data.link} style={{ display: "inline-block", marginTop: "1rem", padding: "12px 16px", background: "#000", color: "#BFFC00", borderRadius: "8px", textDecoration: "none", fontWeight: 700 }}>
                Continue to dashboard
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
