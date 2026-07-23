import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { prisma } from "../lib/db.server";
import { createMagicLinkToken } from "../lib/portal-auth.server";
import { notify } from "../lib/klaviyo.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  // The sign-up link is only meaningful when we know which store to register
  // for (its portalCode). If there's no valid code, we hide it entirely.
  const setting = code ? await prisma.shopSettings.findUnique({ where: { portalCode: code } }) : null;
  return json({ code, validCode: Boolean(setting) });
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
  const { code, validCode } = useLoaderData<typeof loader>();

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, sans-serif", padding: "1rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <svg width="84" height="84" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Influencer Rewards by Boko">
          <rect width="120" height="120" rx="26" fill="#5B5BF5" />
          <path d="M60 44 L63.8 54.7 L75.2 55.1 L66.2 62 L69.4 72.9 L60 66.5 L50.6 72.9 L53.8 62 L44.8 55.1 L56.2 54.7 Z" fill="none" stroke="#9BD40B" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="30" cy="54" r="7.5" stroke="#FFFFFF" strokeWidth="4" fill="none" />
          <path d="M20 78 v-2 a10 10 0 0 1 20 0 v2" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="90" cy="54" r="7.5" stroke="#FFFFFF" strokeWidth="4" fill="none" />
          <path d="M80 78 v-2 a10 10 0 0 1 20 0 v2" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M38 30 A32 32 0 0 1 86 34" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M79 31 L86 34 L83 41" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M82 90 A32 32 0 0 1 34 86" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M41 89 L34 86 L37 79" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
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
        {validCode ? (
          <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid #E1E3E5", textAlign: "center" }}><span style={{ fontSize: "13px", color: "#000000" }}>Don't have an account yet? </span><a href={"/portal/register?code=" + code} style={{ fontSize: "13px", color: "#000000", fontWeight: 700, textDecoration: "underline" }}>Apply to join the program</a></div>
        ) : null}
      </div>
    </div>
  );
}
