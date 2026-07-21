import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ showForm: Boolean(login) });
}

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Influencer Rewards by Boko</h1>
      <p>Shopify influencer marketing app. Install it from your store admin.</p>
      {showForm && (
        <form method="post" action="/auth/login">
          <label>
            Shop domain
            <input type="text" name="shop" placeholder="my-shop-name.myshopify.com" />
          </label>
          <button type="submit">Log in</button>
        </form>
      )}
    </div>
  );
}
