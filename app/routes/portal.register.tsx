import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Form, useNavigation } from "@remix-run/react";
import { randomBytes } from "crypto";
import { prisma } from "../lib/db.server";
import { hashPassword } from "../lib/password.server";
import { notify, notifyAdmin } from "../lib/klaviyo.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const setting = code ? await prisma.shopSettings.findUnique({ where: { portalCode: code } }) : null;
  return json({ code, valid: Boolean(setting) });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const phone = String(form.get("phone") || "").trim();
  const instagramHandle = String(form.get("instagramHandle") || "").trim();
  const tiktokHandle = String(form.get("tiktokHandle") || "").trim();
  const audienceSize = String(form.get("audienceSize") || "").trim();
  const pitch = String(form.get("pitch") || "").trim();
  const password = String(form.get("password") || "");
  const code = String(form.get("code") || "").trim();
  const setting = code ? await prisma.shopSettings.findUnique({ where: { portalCode: code } }) : null;
  const shop = setting?.shop || null;
  if (!shop) return json({ error: "This registration link is invalid. Please use the link your store shared with you." }, { status: 400 });

  if (!firstName || !lastName || !email || !password) {
    return json({ error: "Please fill in your name, email and password." }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.influencer.findFirst({ where: { shop, email } });
  if (existing) {
    return json({ error: "An application with this email already exists." }, { status: 400 });
  }

  const base = (firstName + lastName).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "INFLU";
  let referralCode = base + Math.floor(1000 + Math.random() * 9000);
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.influencer.findFirst({ where: { shop, referralCode } });
    if (!clash) break;
    referralCode = base + Math.floor(1000 + Math.random() * 9000);
  }

  const createdInfluencer = await prisma.influencer.create({
    data: {
      authUserId: "reg-" + randomBytes(12).toString("hex"),
      firstName,
      lastName,
      email,
      phone: phone || null,
      instagramHandle: instagramHandle || null,
      tiktokHandle: tiktokHandle || null,
      audienceSize: audienceSize || null,
      pitch: pitch || null,
      passwordHash: hashPassword(password),
      referralCode,
      status: "pending",
      shop,
    },
  });

  try { await notify("Influencer Registered", createdInfluencer.id, {}); } catch (e) { console.error("[register] signup email failed", e); }
  try {
    await notifyAdmin(shop, "New Influencer Application", {
      applicant_name: `${firstName} ${lastName}`,
      applicant_email: email,
      instagram: instagramHandle || "—",
      audience: audienceSize || "—",
    });
  } catch (e) { console.error("[register] admin notify failed", e); }
  return json({ ok: true });
}

export default function Register() {
  const { code } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state !== "idle";
  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #D9D9D9", boxSizing: "border-box" as const, fontSize: "13px", fontFamily: "Poppins, sans-serif" };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "3px" };

  if (actionData && "ok" in actionData && actionData.ok) {
    return (
      <div style={{ maxWidth: "520px", margin: "3rem auto", padding: "0 1rem", fontFamily: "Poppins, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "0.75rem" }}>Application received</h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6 }}>Thanks for applying. Our team will review your application and email you an access link once you are approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#FFFFFF", padding: "1.25rem", fontFamily: "Poppins, sans-serif", boxSizing: "border-box" as const }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>Join our influencer program</h1>
        <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 14px", lineHeight: 1.4 }}>Apply below — we review every application and email you access once approved.</p>
        {actionData && "error" in actionData && actionData.error ? (
          <div style={{ background: "#fff0f0", border: "1px solid #d00", color: "#b00", padding: "8px 10px", borderRadius: "8px", marginBottom: "10px", fontSize: "12px" }}>{actionData.error}</div>
        ) : null}
        <Form method="post">
          <input type="hidden" name="code" value={code} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "12px", rowGap: "8px" }}>
            <div><label style={labelStyle}>First name</label><input name="firstName" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Last name</label><input name="lastName" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Email</label><input name="email" type="email" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Phone</label><input name="phone" style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram handle</label><input name="instagramHandle" placeholder="@yourhandle" style={inputStyle} /></div>
            <div><label style={labelStyle}>TikTok handle</label><input name="tiktokHandle" placeholder="@yourhandle" style={inputStyle} /></div>
            <div><label style={labelStyle}>Audience size</label><input name="audienceSize" placeholder="e.g. 25,000" style={inputStyle} /></div>
            <div><label style={labelStyle}>Password</label><input name="password" type="password" minLength={8} style={inputStyle} required /></div>
          </div>
          <div style={{ marginTop: "8px" }}>
            <label style={labelStyle}>Why do you want to join?</label>
            <textarea name="pitch" rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
          </div>
          <button type="submit" disabled={submitting} style={{ width: "100%", marginTop: "12px", padding: "11px", background: "#000000", color: "#FFFFFF", fontWeight: 600, border: "none", borderRadius: "100px", cursor: "pointer", fontSize: "14px", fontFamily: "Poppins, sans-serif" }}>
          {submitting ? "Submitting..." : "Submit application"}
          </button>
        </Form>
      </div>
    </div>
  );
}
