import crypto from "crypto";
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { prisma } from "./db.server";

const secret = process.env.SESSION_SECRET || "dev-insecure-secret";

export const portalSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "boko_portal_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [secret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
});

export async function createPortalSession(influencerId: string, redirectTo: string) {
  const session = await portalSessionStorage.getSession();
  session.set("influencerId", influencerId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await portalSessionStorage.commitSession(session) },
  });
}

export async function getPortalInfluencerId(request: Request): Promise<string | null> {
  const session = await portalSessionStorage.getSession(request.headers.get("Cookie"));
  return session.get("influencerId") ?? null;
}

export async function requirePortalInfluencer(request: Request) {
  const influencerId = await getPortalInfluencerId(request);
  if (!influencerId) {
    throw redirect("/portal/login");
  }
  const influencer = await prisma.influencer.findUnique({ where: { id: influencerId } });
  if (!influencer || influencer.status !== "approved") {
    throw redirect("/portal/login");
  }
  return influencer;
}

export async function destroyPortalSession(request: Request) {
  const session = await portalSessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/portal/login", {
    headers: { "Set-Cookie": await portalSessionStorage.destroySession(session) },
  });
}

// --- Magic link tokens (HMAC-signed, 15 minute expiry) ---

export function createMagicLinkToken(influencerId: string): string {
  const expires = Date.now() + 15 * 60 * 1000;
  const payload = `${influencerId}.${expires}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyMagicLinkToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [influencerId, expiresStr, sig] = decoded.split(".");
    const expires = Number(expiresStr);
    if (!influencerId || !expires || !sig) return null;
    const payload = `${influencerId}.${expires}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    if (Date.now() > expires) return null;
    return influencerId;
  } catch {
    return null;
  }
}
