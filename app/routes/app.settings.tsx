import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { authenticate } from "../shopify.server";

/**
 * Layout route for /app/settings/*.
 *
 * When the path is exactly /app/settings (no sub-page), redirect to
 * /app/settings/emails.  Shopify App Bridge sometimes strips the full nav
 * URL down to the parent segment when the merchant returns to the app.
 *
 * For all other /app/settings/* paths (e.g. /app/settings/emails) we simply
 * authenticate and render <Outlet /> so the child route's component can mount.
 * Without the <Outlet /> the child page would never appear, and without the
 * path guard the redirect would loop infinitely on /app/settings/emails itself.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, ""); // strip trailing slash

  if (path === "/app/settings") {
    return redirect("/app/settings/emails");
  }

  // Child route handles everything else — just return null to let it through.
  return null;
}

export default function SettingsLayout() {
  return <Outlet />;
}
