import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import { Page, Layout, Card, IndexTable, Badge, Text, Button, BlockStack, FormLayout, Select, TextField, InlineError } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import BokoBanner from "../components/admin/BokoBanner";
import HowToUse from "../components/admin/HowToUse";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const discountCodes = await prisma.discountCode.findMany({
    where: { influencer: { shop: session.shop } },
    orderBy: { id: "desc" },
    take: 100,
    include: { influencer: { select: { firstName: true, lastName: true } } },
  });

  const influencers = await prisma.influencer.findMany({
    where: { status: "approved", shop: session.shop },
    select: { id: true, firstName: true, lastName: true, referralCode: true },
    orderBy: { firstName: "asc" },
  });

  return json({
    discountCodes: discountCodes.map((d) => ({
      id: d.id,
      influencerName: `${d.influencer.firstName} ${d.influencer.lastName}`,
      code: d.code,
      type: d.type,
      value: d.value.toString(),
      usageLimit: d.usageLimit,
      timesUsed: d.timesUsed,
      active: d.active,
      expiresAt: d.expiresAt,
    })),
    influencers,
  });
}

export default function AppDiscounts() {
  const { discountCodes, influencers } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<{ ok?: boolean; error?: string; errors?: { message: string }[] }>();

  const [influencerId, setInfluencerId] = useState(influencers[0]?.id ?? "");
  const [code, setCode] = useState(influencers[0]?.referralCode ?? "");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("10");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const submitting = createFetcher.state !== "idle";

  const handleCreate = () => {
    createFetcher.submit(
      {
        influencerId,
        code,
        type,
        value: Number(value),
        usageLimit: usageLimit ? Number(usageLimit) : null,
        expiresAt: expiresAt || null,
      },
      { method: "post", action: "/api/discounts/create", encType: "application/json" }
    );
  };

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Discount Codes" subtitle="Create and manage influencer discount codes synced to Shopify." />
            <HowToUse title="Instructions for the Discounts module"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Create a discount code and tie it to an influencer.</li><li>Any order using the code is attributed to that influencer.</li><li>Set the discount value, then create the code.</li><li>Give the code to the influencer to promote with their referral link.</li></ul></HowToUse>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Create discount code</Text>
              <FormLayout>
                <FormLayout.Group>
                  <Select
                    label="Influencer"
                    name="influencerId"
                    options={influencers.map((i) => ({ label: `${i.firstName} ${i.lastName}`, value: i.id }))}
                    value={influencerId}
                    onChange={(v) => setInfluencerId(v)}
                  />
                  <TextField
                    label="Code"
                    name="code"
                    value={code}
                    onChange={(v) => setCode(v.toUpperCase())}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <Select
                    label="Type"
                    options={[
                      { label: "Percentage", value: "percentage" },
                      { label: "Fixed amount", value: "fixed" },
                    ]}
                    value={type}
                    onChange={(v) => setType(v as "percentage" | "fixed")}
                  />
                  <TextField
                    label={type === "percentage" ? "Percentage (%)" : "Amount (AUD)"}
                    type="number"
                    value={value}
                    onChange={setValue}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <TextField
                    label="Usage limit (optional)"
                    type="number"
                    value={usageLimit}
                    onChange={setUsageLimit}
                    autoComplete="off"
                  />
                  <TextField
                    label="Expires (optional)"
                    type="date"
                    value={expiresAt}
                    onChange={setExpiresAt}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                {createFetcher.data?.error && <InlineError message={createFetcher.data.error} fieldID="code" />}
                {createFetcher.data?.errors?.map((e, i) => (
                  <InlineError key={i} message={e.message} fieldID="code" />
                ))}
                <Button onClick={handleCreate} loading={submitting} variant="primary" disabled={!influencerId || !code}>
                  Create discount code
                </Button>
              </FormLayout>
              </BlockStack>
            </Card>

            <Card padding="0">
              <IndexTable
              itemCount={discountCodes.length}
              headings={[
                { title: "Influencer" },
                { title: "Code" },
                { title: "Type" },
                { title: "Value" },
                { title: "Usage" },
                { title: "Status" },
                { title: "Expires" },
              ]}
              selectable={false}
            >
              {discountCodes.map((d, index) => (
                <IndexTable.Row id={d.id} key={d.id} position={index}>
                  <IndexTable.Cell>{d.influencerName}</IndexTable.Cell>
                  <IndexTable.Cell>{d.code}</IndexTable.Cell>
                  <IndexTable.Cell>{d.type}</IndexTable.Cell>
                  <IndexTable.Cell>{d.type === "percentage" ? `${d.value}%` : `$${d.value}`}</IndexTable.Cell>
                  <IndexTable.Cell>{d.timesUsed}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={d.active ? "success" : "critical"}>{d.active ? "Active" : "Inactive"}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "Never"}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
            {discountCodes.length === 0 && (
              <div style={{ padding: "20px 24px" }}>
                <Text as="p">No discount codes yet.</Text>
              </div>
            )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
