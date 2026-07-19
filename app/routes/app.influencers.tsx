import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import InfluencerManagement from "../components/admin/InfluencerManagement";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const influencers = await prisma.influencer.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      referralCode: true,
      bio: true,
      createdAt: true,
    },
  });

  return json({ influencers });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const firstName = String(form.get("firstName") || "").trim();
  const lastName = String(form.get("lastName") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const referralCode = String(form.get("referralCode") || "").trim().toUpperCase();

  if (!firstName || !lastName || !email || !referralCode) {
    return json({ error: "All fields are required." }, { status: 400 });
  }

  try {
    await prisma.influencer.create({
      data: {
        firstName,
        lastName,
        email,
        referralCode,
        status: "pending",
        authUserId: "manual-" + referralCode,
        shop: session.shop,
      },
    });
  } catch (err: any) {
    return json({ error: "That email or referral code is already in use." }, { status: 400 });
  }

  return json({ ok: true });
}

export default function AppInfluencers() {
  const { influencers } = useLoaderData<typeof loader>();
  return <InfluencerManagement influencers={influencers} />;
}
