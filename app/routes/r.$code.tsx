import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import crypto from "crypto";
import { prisma } from "../lib/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const code = (params.code || "").trim();
  if (!code) return redirect("/");

  const influencer = await prisma.influencer.findFirst({
    where: { referralCode: code },
  });

  if (!influencer) return redirect("/");

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    await prisma.click.create({
      data: {
        influencerId: influencer.id,
        ipHash,
        userAgent: request.headers.get("user-agent") || null,
        referrer: request.headers.get("referer") || null,
      },
    });
  } catch (e) {
    console.error("[r.$code] click log failed", e);
  }

  const dest =
    "https://" + influencer.shop + "/?ref=" + encodeURIComponent(code);
  return redirect(dest);
}
