import { Form, Link, useLocation } from "@remix-run/react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/commissions", label: "Commissions" },
  { href: "/portal/rewards", label: "Rewards" },
  { href: "/portal/payouts", label: "Payouts" },
  { href: "/portal/bank-details", label: "Bank Details" },
];

export default function PortalShell({ influencerName, children }: { influencerName: string; children: ReactNode }) {
  const location = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ background: "#000000", color: "#FFFFFF", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", background: "#BFFC00", borderRadius: "6px" }} />
          <div style={{ fontWeight: 700 }}>Boko Influencer Portal</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", opacity: 0.8 }}>{influencerName}</span>
          <Form method="post" action="/portal/logout">
            <button type="submit" style={{ background: "transparent", border: "1px solid #BFFC00", color: "#BFFC00", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>
              Log out
            </button>
          </Form>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <nav style={{ width: "200px", background: "#FFFFFF", minHeight: "calc(100vh - 64px)", padding: "1.5rem 0", borderRight: "1px solid #eee" }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  display: "block",
                  padding: "10px 1.5rem",
                  fontSize: "14px",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#000" : "#555",
                  background: active ? "#F8F9FC" : "transparent",
                  borderLeft: active ? "3px solid #BFFC00" : "3px solid transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main style={{ flex: 1, padding: "2rem" }}>{children}</main>
      </div>
    </div>
  );
}
