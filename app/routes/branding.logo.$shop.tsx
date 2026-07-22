import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const shop = params.shop || "";
  const s = await prisma.shopSettings.findUnique({
    where: { shop },
    select: { logoImage: true, logoMime: true },
  });
  if (!s || !s.logoImage) {
    return new Response("Not found", { status: 404 });
  }
  const body = Buffer.from(s.logoImage);
  return new Response(body, {
    headers: {
      "Content-Type": s.logoMime || "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
