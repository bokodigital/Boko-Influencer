import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Form, useNavigation } from "@remix-run/react";
import { randomBytes } from "crypto";
import { prisma } from "../lib/db.server";
import { hashPassword } from "../lib/password.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return json({ shop: url.searchParams.get("shop") || "" });
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
  const shop = String(form.get("shop") || "").trim() || null;

  if (!firstName || !lastName || !email || !password) {
    return json({ error: "Please fill in your name, email and password." }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.influencer.findUnique({ where: { email } });
  if (existing) {
    return json({ error: "An application with this email already exists." }, { status: 400 });
  }

  const base = (firstName + lastName).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "INFLU";
  let referralCode = base + Math.floor(1000 + Math.random() * 9000);
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.influencer.findUnique({ where: { referralCode } });
    if (!clash) break;
    referralCode = base + Math.floor(1000 + Math.random() * 9000);
  }

  await prisma.influencer.create({
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

  return json({ ok: true });
}

export default function Register() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state !== "idle";
  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #000000", marginBottom: "1rem", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" };

  if (actionData && "ok" in actionData && actionData.ok) {
    return (
      <div style={{ maxWidth: "520px", margin: "3rem auto", padding: "0 1rem", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "0.75rem" }}>Application received</h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6 }}>Thanks for applying. Our team will review your application and email you an access link once you are approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "520px", margin: "3rem auto", padding: "0 1rem", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <h1 style={{ fontSize: "26px", fontWeight: 700, marginBottom: "0.5rem" }}>Become an Influencer</h1>
      <p style={{ fontSize: "14px", color: "#000000", marginBottom: "1.5rem" }}>Apply to join our influencer program. We review every application and send you portal access once approved.</p>
      {actionData && "error" in actionData && actionData.error ? (
        <div style={{ background: "#fff0f0", border: "1px solid #d00", color: "#b00", padding: "10px 12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px" }}>{actionData.error}</div>
      ) : null}
      <Form method="post">
        <input type="hidden" name="shop" value={shop} />
        <label style={labelStyle}>First name</label>
        <input name="firstName" style={inputStyle} required />
        <label style={labelStyle}>Last name</label>
        <input name="lastName" style={inputStyle} required />
        <label style={labelStyle}>Email</label>
        <input name="email" type="email" style={inputStyle} required />
        <label style={labelStyle}>Phone</label>
        <input name="phone" style={inputStyle} />
        <label style={labelStyle}>Instagram handle</label>
        <input name="instagramHandle" placeholder="@yourhandle" style={inputStyle} />
        <label style={labelStyle}>TikTok handle</label>
        <input name="tiktokHandle" placeholder="@yourhandle" style={inputStyle} />
        <label style={labelStyle}>Audience size</label>
        <input name="audienceSize" placeholder="e.g. 25,000 followers" style={inputStyle} />
        <label style={labelStyle}>Why do you want to join?</label>
        <textarea name="pitch" rows={4} style={{ ...inputStyle, resize: "vertical" as const }} />
        <label style={labelStyle}>Choose a password</label>
        <input name="password" type="password" minLength={8} style={inputStyle} required />
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: "12px", background: "#BFFC00", fontWeight: 700, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "15px" }}>
          {submitting ? "Submitting..." : "Submit application"}
        </button>
      </Form>
    </div>
  );
}
