const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

async function token() {
  const auth = Buffer.from((process.env.PAYPAL_CLIENT_ID || "") + ":" + (process.env.PAYPAL_SECRET || "")).toString("base64");
  const r = await fetch(BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error("PayPal token error: " + r.status);
  return d.access_token as string;
}

export async function sendPayPalPayout(p: { email: string; amount: number; currency?: string; note?: string }) {
  const t = await token();
  const batch = "boko-" + Date.now();
  const r = await fetch(BASE + "/v1/payments/payouts", {
    method: "POST",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify({ sender_batch_header: { sender_batch_id: batch, email_subject: "Your Boko payout" }, items: [{ recipient_type: "EMAIL", receiver: p.email, note: p.note || "Commission payout", sender_item_id: batch, amount: { value: p.amount.toFixed(2), currency: p.currency || "AUD" } }] }),
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error("PayPal payout error: " + r.status + " " + JSON.stringify(d));
  return { batchId: (d && d.batch_header && d.batch_header.payout_batch_id) || batch, status: (d && d.batch_header && d.batch_header.batch_status) || "PENDING" };
}
