import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  FormLayout,
  TextField,
  Checkbox,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { encryptValue, maskAccountNumber } from "../lib/crypto.server";
import { KLAVIYO_EVENTS, DEFAULT_TEMPLATES } from "../lib/klaviyo.server";
import BokoBanner from "../components/admin/BokoBanner";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const templates = await prisma.emailTemplate.findMany({ where: { shop } });

  const templateByEvent = new Map(templates.map((t) => [t.event, t]));
  const events = KLAVIYO_EVENTS.map((event) => {
    const custom = templateByEvent.get(event);
    const fallback = DEFAULT_TEMPLATES[event];
    return {
      event,
      subject: custom?.subject ?? fallback.subject,
      body: custom?.body ?? fallback.body,
      enabled: custom?.enabled ?? true,
      isCustom: Boolean(custom),
    };
  });

  return json({
    hasKlaviyo: Boolean(settings?.klaviyoApiKeyEncrypted),
    maskedKey: settings?.klaviyoApiKeyEncrypted ? maskAccountNumber("klaviyo-connected-key") : null,
    senderName: settings?.senderName ?? "",
    events,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_klaviyo") {
    const apiKey = String(formData.get("apiKey") || "").trim();
    if (!apiKey) {
      await prisma.shopSettings.upsert({
        where: { shop },
        update: { klaviyoApiKeyEncrypted: null },
        create: { shop },
      });
      return json({ ok: true, cleared: true });
    }
    await prisma.shopSettings.upsert({
      where: { shop },
      update: { klaviyoApiKeyEncrypted: encryptValue(apiKey) },
      create: { shop, klaviyoApiKeyEncrypted: encryptValue(apiKey) },
    });
    return json({ ok: true });
  }

  if (intent === "save_sender") {
    const senderName = String(formData.get("senderName") || "").trim();
    await prisma.shopSettings.upsert({
      where: { shop },
      update: { senderName: senderName || null },
      create: { shop, senderName: senderName || null },
    });
    return json({ ok: true });
  }

  if (intent === "save_template") {
    const event = String(formData.get("event"));
    const subject = String(formData.get("subject") || "");
    const body = String(formData.get("body") || "");
    const enabled = formData.get("enabled") === "true";

    await prisma.emailTemplate.upsert({
      where: { shop_event: { shop, event } },
      update: { subject, body, enabled },
      create: { shop, event, subject, body, enabled },
    });
    return json({ ok: true, event });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

function TemplateCard({ item }: { item: ReturnType<typeof useLoaderData<typeof loader>>["events"][number] }) {
  const fetcher = useFetcher<{ ok?: boolean }>();
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [enabled, setEnabled] = useState(item.enabled);

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text as="h3" variant="headingSm">{item.event}</Text>
          <Checkbox label="Enabled" checked={enabled} onChange={setEnabled} />
        </InlineStack>
        <FormLayout>
          <TextField label="Subject" autoComplete="off" value={subject} onChange={setSubject} />
          <TextField label="Body" autoComplete="off" multiline={4} value={body} onChange={setBody} />
        </FormLayout>
        <Text as="p" tone="subdued" variant="bodySm">
          Merge tags: {"{{first_name}} {{amount}} {{code}} {{referral_code}} {{order_id}} {{link}} {{method}} {{reward_title}} {{reward_type}} {{portal_login_url}}"}
        </Text>
        <InlineStack align="end">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="save_template" />
            <input type="hidden" name="event" value={item.event} />
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="body" value={body} />
            <input type="hidden" name="enabled" value={String(enabled)} />
            <Button submit variant="primary" loading={fetcher.state !== "idle"}>Save</Button>
          </fetcher.Form>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export default function EmailSettings() {
  const data = useLoaderData<typeof loader>();
  const klaviyoFetcher = useFetcher<{ ok?: boolean }>();
  const senderFetcher = useFetcher<{ ok?: boolean }>();
  const [hasKlaviyo, setHasKlaviyo] = useState(data.hasKlaviyo);
  const [apiKey, setApiKey] = useState("");
  const [senderName, setSenderName] = useState(data.senderName);

  return (
    <Page>
      <BokoBanner
        title="Email settings"
        subtitle="Connect your own Klaviyo account, or customise the built-in emails sent for each program event."
      />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Klaviyo</Text>
              <Checkbox
                label="I have my own Klaviyo account"
                checked={hasKlaviyo}
                onChange={setHasKlaviyo}
              />
              {hasKlaviyo && (
                <klaviyoFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save_klaviyo" />
                  <FormLayout>
                    <TextField
                      label="Klaviyo private API key"
                      type="password"
                      autoComplete="off"
                      name="apiKey"
                      value={apiKey}
                      onChange={setApiKey}
                      placeholder={data.hasKlaviyo ? "•••••••• (saved — enter a new key to replace)" : "pk_xxxxxxxx"}
                    />
                  </FormLayout>
                  <InlineStack align="end">
                    <Button submit variant="primary" loading={klaviyoFetcher.state !== "idle"}>
                      Save
                    </Button>
                  </InlineStack>
                </klaviyoFetcher.Form>
              )}
              {!hasKlaviyo && (
                <Banner tone="info">
                  Without Klaviyo connected, program emails send automatically through Boko's
                  built-in system using the templates below.
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Sender display name</Text>
              <Text as="p" tone="subdued" variant="bodySm">
                The name that appears in the "From" field of emails sent to influencers. Leave blank to use "Influencer Program".
              </Text>
              <senderFetcher.Form method="post">
                <input type="hidden" name="intent" value="save_sender" />
                <FormLayout>
                  <TextField
                    label="Display name"
                    autoComplete="off"
                    name="senderName"
                    value={senderName}
                    onChange={setSenderName}
                    placeholder="Influencer Program"
                  />
                </FormLayout>
                <InlineStack align="end">
                  <Button submit variant="primary" loading={senderFetcher.state !== "idle"}>
                    Save
                  </Button>
                </InlineStack>
              </senderFetcher.Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Email templates</Text>
            {data.events.map((item) => (
              <TemplateCard key={item.event} item={item} />
            ))}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
