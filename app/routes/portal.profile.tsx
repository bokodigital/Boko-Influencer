import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import type { CSSProperties } from "react";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { requirePortalInfluencer } from "../lib/portal-auth.server";
import { prisma } from "../lib/db.server";
import PortalShell from "../components/portal/PortalShell";

export async function loader({ request }: LoaderFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);
  const inf = await prisma.influencer.findUnique({
    where: { id: influencer.id },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      instagramHandle: true,
      tiktokHandle: true,
      audienceSize: true,
      bio: true,
    },
  });
  return json({ influencerName: `${influencer.firstName} ${influencer.lastName}`, inf });
}

export async function action({ request }: ActionFunctionArgs) {
  const influencer = await requirePortalInfluencer(request);
  const form = await request.formData();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  if (!firstName || !lastName) {
    return json({ error: "First and last name are required." }, { status: 400 });
  }
  await prisma.influencer.update({
    where: { id: influencer.id },
    data: {
      firstName,
      lastName,
      phone: String(form.get("phone") || "").trim() || null,
      instagramHandle: String(form.get("instagramHandle") || "").trim() || null,
      tiktokHandle: String(form.get("tiktokHandle") || "").trim() || null,
      audienceSize: String(form.get("audienceSize") || "").trim() || null,
      bio: String(form.get("bio") || "").trim() || null,
    },
  });
  return json({ ok: true });
}

const labelStyle: CSSProperties = { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#000000" };
const inputStyle: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #D9D9D9", marginBottom: "1rem", boxSizing: "border-box", fontSize: "14px", fontFamily: "Poppins, sans-serif" };

export default function PortalProfile() {
  const { influencerName, inf } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  return (
    <PortalShell influencerName={influencerName}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, margin: "0 0 0.5rem", color: "#000000" }}>My profile</h1>
      <p style={{ fontSize: "14px", color: "#272727", margin: "0 0 2rem", maxWidth: "560px", lineHeight: 1.6 }}>
        Keep your details up to date so the store can reach you and credit your referrals correctly.
      </p>

      {actionData && "ok" in actionData && actionData.ok ? (
        <div style={{ background: "#F1F1F1", border: "1px solid #D9D9D9", color: "#000000", padding: "10px 12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px" }}>
          Your profile has been saved.
        </div>
      ) : null}
      {actionData && "error" in actionData && actionData.error ? (
        <div style={{ background: "#FDECEC", border: "1px solid #E4B4B4", color: "#B00020", padding: "10px 12px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px" }}>
          {actionData.error}
        </div>
      ) : null}

      <div style={{ background: "#FFFFFF", border: "1px solid #ECECEC", borderRadius: "16px", padding: "1.5rem", maxWidth: "620px" }}>
        <Form method="post">
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First name</label>
              <input name="firstName" defaultValue={inf?.firstName ?? ""} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last name</label>
              <input name="lastName" defaultValue={inf?.lastName ?? ""} style={inputStyle} required />
            </div>
          </div>

          <label style={labelStyle}>Email</label>
          <input value={inf?.email ?? ""} style={{ ...inputStyle, background: "#F5F5F5", color: "#6B6B6B", marginBottom: "0.35rem" }} disabled />
          <div style={{ fontSize: "12px", color: "#6B6B6B", marginBottom: "1rem" }}>
            Your email is used to log in and can’t be changed here — contact the store if it needs updating.
          </div>

          <label style={labelStyle}>Phone</label>
          <input name="phone" defaultValue={inf?.phone ?? ""} style={inputStyle} />

          <label style={labelStyle}>Instagram handle</label>
          <input name="instagramHandle" defaultValue={inf?.instagramHandle ?? ""} placeholder="@yourhandle" style={inputStyle} />

          <label style={labelStyle}>TikTok handle</label>
          <input name="tiktokHandle" defaultValue={inf?.tiktokHandle ?? ""} placeholder="@yourhandle" style={inputStyle} />

          <label style={labelStyle}>Audience size</label>
          <input name="audienceSize" defaultValue={inf?.audienceSize ?? ""} placeholder="e.g. 25,000 followers" style={inputStyle} />

          <label style={labelStyle}>Bio</label>
          <textarea name="bio" defaultValue={inf?.bio ?? ""} rows={4} style={{ ...inputStyle, resize: "vertical" }} />

          <button
            type="submit"
            disabled={saving}
            style={{ background: "#000000", color: "#FFFFFF", border: "none", borderRadius: "100px", padding: "12px 28px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "Poppins, sans-serif" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </Form>
      </div>
    </PortalShell>
  );
}
