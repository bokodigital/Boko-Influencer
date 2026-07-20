import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import { encryptValue, decryptValue, maskAccountNumber } from "../lib/crypto.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);

  const bankDetail = await prisma.bankDetail.findFirst({
    where: { influencerId: influencer.id, isDefault: true },
  });

  return json({
    influencerName: `${influencer.firstName} ${influencer.lastName}`,
    stripeConnected: !!influencer.stripeAccountId,
    bankDetail: bankDetail
      ? {
          method: bankDetail.method,
          accountName: bankDetail.accountName,
          paypalEmail: bankDetail.paypalEmail,
          maskedAccountNumber: bankDetail.accountNumberEncrypted ? maskAccountNumber(decryptValue(bankDetail.accountNumberEncrypted)) : null,
          maskedBsb: bankDetail.bsbEncrypted ? decryptValue(bankDetail.bsbEncrypted) : null,
          verified: bankDetail.verified,
        }
      : null,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);
  const formData = await request.formData();

  const method = String(formData.get("method"));
  const accountName = String(formData.get("accountName") || "") || null;
  const bsb = String(formData.get("bsb") || "");
  const accountNumber = String(formData.get("accountNumber") || "");
  const paypalEmail = String(formData.get("paypalEmail") || "") || null;

  const existing = await prisma.bankDetail.findFirst({ where: { influencerId: influencer.id, isDefault: true } });

  const data = {
    method: method as any,
    accountName,
    bsbEncrypted: bsb ? encryptValue(bsb) : null,
    accountNumberEncrypted: accountNumber ? encryptValue(accountNumber) : null,
    paypalEmail,
    isDefault: true,
    verified: false,
  };

  if (existing) {
    await prisma.bankDetail.update({ where: { id: existing.id }, data });
  } else {
    await prisma.bankDetail.create({ data: { influencerId: influencer.id, ...data } });
  }

  return json({ ok: true });
}

export default function PortalBankDetails() {
  const { influencerName, bankDetail, stripeConnected } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean }>();
  const [method, setMethod] = useState(bankDetail?.method ?? "bank_transfer");

  return (
    <PortalShell influencerName={influencerName}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "0.5rem" }}>Bank details</h1>
      <p style={{ color: "#000000", marginBottom: "1.5rem", fontSize: "14px" }}>
        Used to process your payouts. Account numbers are encrypted at rest.
      </p>

      {bankDetail && (
        <div style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: "13px", color: "#000000", marginBottom: "4px" }}>Currently on file</div>
          <div style={{ fontWeight: 600 }}>
            {bankDetail.method === "paypal"
              ? `PayPal — ${bankDetail.paypalEmail}`
              : `${bankDetail.accountName ?? "Account"} — BSB ${bankDetail.maskedBsb ?? "—"} — ${bankDetail.maskedAccountNumber ?? "—"}`}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "8px", display: "inline-block", padding: "4px 10px", borderRadius: "999px", background: bankDetail.verified ? "#BFFC00" : "#F8F9FC", color: "#000000" }}>
            {bankDetail.verified ? "Verified" : "Pending verification"}
          </div>
        </div>
      )}

      <fetcher.Form method="post" style={{ background: "#fff", borderRadius: "10px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", maxWidth: "480px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Payout method</label>
        <select name="method" value={method} onChange={(e) => setMethod(e.target.value as "bank_transfer" | "paypal" | "other")} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem" }}>
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="other">Other</option>
        </select>

        {method === "paypal" && (<><label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>PayPal email</label><input name="paypalEmail" type="email" defaultValue={bankDetail?.paypalEmail ?? ""} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" }} /></>)}
              {method === "bank_transfer" && (
          <>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Account name</label>
            <input name="accountName" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>BSB</label>
            <input name="bsb" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Account number</label>
            <input name="accountNumber" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" }} />
          </>
        )}

        {method === "paypal" && (
          <>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>PayPal email</label>
            <input name="paypalEmail" type="email" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" }} />
          </>
        )}

        <button type="submit" style={{ width: "100%", padding: "12px", background: "#BFFC00", fontWeight: 700, border: "none", borderRadius: "8px", cursor: "pointer" }}>
          {fetcher.state !== "idle" ? "Saving..." : "Save bank details"}
        </button>
        {fetcher.data?.ok && <div style={{ color: "#000000", fontWeight: 600, fontSize: "13px", marginTop: "8px" }}>Saved — pending verification.</div>}
      </fetcher.Form>
        <div style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", marginTop: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>Pay me via Stripe</div>
          <div style={{ fontSize: "13px", color: "#000000", marginBottom: "12px" }}>{stripeConnected ? "Your Stripe account is connected. Re-open onboarding to update details." : "Connect a Stripe account to receive payouts to your bank."}</div>
          <a href="/portal/stripe-connect" style={{ display: "inline-block", padding: "10px 20px", background: "#000000", color: "#BFFC00", fontWeight: 700, borderRadius: "8px", textDecoration: "none", fontSize: "14px" }}>{stripeConnected ? "Manage Stripe" : "Connect with Stripe"}</a>
        </div>
    </PortalShell>
  );
}
