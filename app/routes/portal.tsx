import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { prisma } from "../lib/db.server";
import { requirePortalInfluencer } from "../lib/portal-auth.server";

/**
 * Layout for all /portal/* routes. Best-effort loads the shop's enabled modules
 * so the shared PortalShell nav can hide disabled modules on every page.
 * Runs for public pages (login/register) too — if the visitor isn't a logged-in
 * influencer, requirePortalInfluencer throws (a redirect), which we swallow here
 * and fall back to showing everything. Each child route still enforces its own auth.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  let modules = { commissions: true, payouts: true, rewards: true };
  try {
    const influencer = await requirePortalInfluencer(request);
    if (influencer?.shop) {
      const s = await prisma.shopSettings.findUnique({
        where: { shop: influencer.shop },
        select: { moduleCommissions: true, modulePayouts: true, moduleRewards: true },
      });
      if (s) {
        modules = { commissions: s.moduleCommissions, payouts: s.modulePayouts, rewards: s.moduleRewards };
      }
    }
  } catch (error) {
    // Not a logged-in influencer (e.g. login/register) or lookup failed — keep defaults.
  }
  return json({ modules });
}

export default function PortalLayout() {
  return <Outlet />;
}
