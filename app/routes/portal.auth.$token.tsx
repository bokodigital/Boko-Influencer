import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { verifyMagicLinkToken, createPortalSession } from "../lib/portal-auth.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) throw redirect("/portal/login");

  const influencerId = verifyMagicLinkToken(token);
  if (!influencerId) throw redirect("/portal/login");

  return createPortalSession(influencerId, "/portal");
}
