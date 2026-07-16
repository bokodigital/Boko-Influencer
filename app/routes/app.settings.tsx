import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * /app/settings has no content of its own — redirect to the emails subpage.
 *
 * Shopify App Bridge sometimes navigates to the parent path of a NavMenu item
 * (e.g. /app/settings instead of /app/settings/emails) when the merchant
 * returns to the app after leaving it. Without this redirect the user sees a
 * blank 404 error page.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return redirect("/app/settings/emails");
}
