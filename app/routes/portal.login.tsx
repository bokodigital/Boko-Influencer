import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { prisma } from "../lib/db.server";
import { createMagicLinkToken } from "../lib/portal-auth.server";
import { notify } from "../lib/klaviyo.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return json({ code: url.searchParams.get("code") || "" });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const code = String(formData.get("code") || "").trim();
  const setting = code ? await prisma.shopSettings.findUnique({ where: { portalCode: code } }) : null;
  const shop = setting?.shop || null;
  const email = String(formData.get("email") || "").trim().toLowerCase();

  const influencer = await prisma.influencer.findFirst({ where: shop ? { email, shop } : { email } });

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
  const { code } = useLoaderData<typeof loader>();

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ background: "#FFFFFF", padding: "2.5rem", borderRadius: "12px", width: "100%", maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>

          <div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Influencer Rewards by Boko</div>
            <div style={{ fontSize: "13px", color: "#000000" }}>Sign in to view your dashboard</div>
          </div>
        </div>

        {!fetcher.data?.sent && (
          <fetcher.Form method="post"><input type="hidden" name="code" value={code} />
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Email address</label>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #D9D9D9", borderRadius: "8px", marginBottom: "1rem", boxSizing: "border-box", fontFamily: "Poppins, sans-serif" }}
            />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              style={{ width: "100%", padding: "12px", background: "#000000", color: "#FFFFFF", fontWeight: 600, border: "none", borderRadius: "100px", cursor: "pointer", fontSize: "14px", fontFamily: "Poppins, sans-serif" }}
            >
              {fetcher.state !== "idle" ? "Sending..." : "Send login link"}
            </button>
          </fetcher.Form>
        )}

        {fetcher.data?.sent && (
          <div>
            <p style={{ fontSize: "14px", color: "#000000" }}>{fetcher.data.message}</p>
            {fetcher.data.link && (
              <a href={fetcher.data.link} style={{ display: "inline-block", marginTop: "1rem", padding: "12px 24px", background: "#000000", color: "#FFFFFF", borderRadius: "100px", textDecoration: "none", fontWeight: 600 }}>
                Continue to dashboard
              </a>
            )}
          </div>
        )}
        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid #E1E3E5", textAlign: "center" }}><span style={{ fontSize: "13px", color: "#000000" }}>Not an influencer yet? </span><a href={"/portal/register?code=" + code} style={{ fontSize: "13px", color: "#000000", fontWeight: 700, textDecoration: "underline" }}>Apply to become an influencer</a></div>
      </div>
    </div>
  );
}
