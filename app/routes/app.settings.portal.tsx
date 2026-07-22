import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Card, Text, BlockStack, InlineStack, TextField, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
    select: { dashboardLogoUrl: true },
  });
  return json({ dashboardLogoUrl: settings?.dashboardLogoUrl ?? "" });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  let dashboardLogoUrl = String(formData.get("logoUrl") || "").trim();
  const logoFile = formData.get("logoFile");
  let dashboardLogoImage: Buffer | undefined;
  let dashboardLogoMime: string | undefined;
  if (logoFile && typeof logoFile === "object" && "arrayBuffer" in logoFile && (logoFile as File).size > 0) {
    const f = logoFile as File;
    dashboardLogoImage = Buffer.from(await f.arrayBuffer());
    dashboardLogoMime = f.type || "image/png";
    dashboardLogoUrl = (process.env.SHOPIFY_APP_URL || "") + "/branding/dashboard-logo/" + encodeURIComponent(shop) + "?v=" + Date.now();
  }
  const imgData = dashboardLogoImage ? { dashboardLogoImage, dashboardLogoMime: dashboardLogoMime || null } : {};
  await prisma.shopSettings.upsert({
    where: { shop },
    update: { dashboardLogoUrl: dashboardLogoUrl || null, ...imgData },
    create: { shop, dashboardLogoUrl: dashboardLogoUrl || null, ...imgData },
  });
  return json({ ok: true });
}

export default function PortalBranding() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean }>();
  const [logoUrl, setLogoUrl] = useState(data.dashboardLogoUrl);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Portal branding" subtitle="The logo shown to influencers on their dashboard. This is separate from the email logo." />
            <HowToUse title="Instructions for Portal branding"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Upload a logo image, or paste a public image URL.</li><li>This logo appears at the top of the influencer dashboard.</li><li>It is separate from the email logo set under Email settings.</li></ul></HowToUse>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Influencer dashboard logo</Text>
                <fetcher.Form method="post" encType="multipart/form-data">
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Upload a logo image (PNG/JPG)</label>
                    <input type="file" name="logoFile" accept="image/*" />
                  </div>
                  <BlockStack gap="300">
                    <TextField
                      label="Or paste a logo URL"
                      autoComplete="off"
                      name="logoUrl"
                      value={logoUrl}
                      onChange={setLogoUrl}
                      placeholder="https://cdn.shopify.com/s/files/…/logo.png"
                    />
                    {logoUrl ? (
                      <InlineStack align="start">
                        <img
                          src={logoUrl}
                          alt="Dashboard logo preview"
                          style={{ maxHeight: 64, maxWidth: 240, objectFit: "contain", borderRadius: 4, border: "1px solid #e1e3e5" }}
                        />
                      </InlineStack>
                    ) : null}
                    <InlineStack align="space-between" blockAlign="center">
                      <Button url="/app/settings">Back to settings</Button>
                      <Button submit variant="primary" loading={fetcher.state !== "idle"}>Save</Button>
                    </InlineStack>
                  </BlockStack>
                </fetcher.Form>
                {fetcher.data?.ok ? <Text as="p" tone="success">Saved.</Text> : null}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
