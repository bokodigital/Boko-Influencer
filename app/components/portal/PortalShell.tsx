import { Form, Link, useLocation, useRouteLoaderData } from "@remix-run/react";
import type { ReactNode } from "react";

type PortalModules = { commissions: boolean; payouts: boolean; rewards: boolean };

export default function PortalShell({ influencerName, children }: { influencerName: string; children: ReactNode }) {
  const location = useLocation();
  const layoutData = useRouteLoaderData("routes/portal") as { modules?: PortalModules } | undefined;
  const modules: PortalModules = layoutData?.modules ?? { commissions: true, payouts: true, rewards: true };

  const navItems = [
    { href: "/portal", label: "Overview", show: true },
    { href: "/portal/commissions", label: "Commissions", show: modules.commissions },
    { href: "/portal/rewards", label: "Rewards", show: modules.rewards },
    { href: "/portal/payouts", label: "Payouts", show: modules.payouts },
    { href: "/portal/bank-details", label: "Payout details", show: modules.payouts },
    { href: "/portal/profile", label: "My profile", show: true },
  ].filter((item) => item.show);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", fontFamily: "Poppins, sans-serif", color: "#000000" }}>
      {/* Header — single black band */}
      <header style={{ background: "#000000", color: "#FFFFFF", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600, fontSize: "16px" }}>Influencer Rewards by Boko</div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", color: "#CFCFCF" }}>{influencerName}</span>
          <Form method="post" action="/portal/logout">
            <button
              type="submit"
              style={{ background: "transparent", border: "1px solid #FFFFFF", color: "#FFFFFF", borderRadius: "100px", padding: "8px 20px", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "Poppins, sans-serif" }}
            >
              Log out
            </button>
          </Form>
        </div>
      </header>

      <div style={{ display: "flex" }}>
        <nav style={{ width: "220px", background: "#FFFFFF", minHeight: "calc(100vh - 64px)", padding: "1.5rem 0", borderRight: "1px solid #ECECEC" }}>
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  display: "block",
                  padding: "12px 1.5rem",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#000000" : "#6B6B6B",
                  background: active ? "#F8F9FC" : "transparent",
                  borderLeft: active ? "3px solid #000000" : "3px solid transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main style={{ flex: 1, padding: "2.5rem", maxWidth: "1040px" }}>{children}</main>
      </div>
    </div>
  );
}
