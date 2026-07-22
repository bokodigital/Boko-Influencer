import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { authenticate } from "../shopify.server";

/**
 * Layout route for /app/settings/*.
 *
 * /app/settings itself renders the settings hub (app.settings._index.tsx),
 * which links out to the individual settings pages (Email settings, Modules).
 * All /app/settings/* children render through <Outlet />.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}

export default function SettingsLayout() {
  return <Outlet />;
}
