import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
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
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/db.server";
import { encryptValue, maskAccountNumber } from "../lib/crypto.server";
import { KLAVIYO_EVENTS, DEFAULT_TEMPLATES } from "../lib/klaviyo.server";
import BokoBanner from "../components/admin/BokoBanner";

/** Upgrade legacy plain-text bodies to HTML so the editor can consume them. */
function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  if (text.trimStart().startsWith("<")) return text;
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ─── Tiptap toolbar button ────────────────────────────────────────────────────

const toolbarBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 8px",
  border: "1px solid #c9cccf",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1,
  color: "#202223",
  minWidth: 28,
};

const toolbarBtnActive: React.CSSProperties = {
  ...toolbarBtn,
  background: "#f1f2f3",
  borderColor: "#8c9196",
};

interface RichTextEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
}

function RichTextEditor({ initialContent, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: false }),
    ],
    content: plainTextToHtml(initialContent),
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  const handleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt("Enter URL");
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div>
      {/* toolbar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "6px 8px",
          borderRadius: "4px 4px 0 0",
          border: "1px solid #c9cccf",
          borderBottom: "none",
          background: "#f6f6f7",
        }}
      >
        <button
          type="button"
          style={editor?.isActive("bold") ? toolbarBtnActive : toolbarBtn}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleBold().run(); }}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          style={editor?.isActive("italic") ? toolbarBtnActive : toolbarBtn}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleItalic().run(); }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          style={editor?.isActive("link") ? toolbarBtnActive : toolbarBtn}
          onMouseDown={(e) => { e.preventDefault(); handleLink(); }}
          title="Link"
        >
          🔗
        </button>
      </div>

      {/* editor area */}
      <div
        style={{
          border: "1px solid #c9cccf",
          borderRadius: "0 0 4px 4px",
          minHeight: 120,
          padding: "8px 12px",
          background: "#fff",
          fontSize: 14,
          lineHeight: 1.6,
          cursor: "text",
        }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

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
    logoUrl: settings?.logoUrl ?? "",
    buttonColor: settings?.buttonColor ?? "#000000",
    headingColor: settings?.headingColor ?? "#000000",
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

  if (intent === "save_branding") {
    const logoUrl = String(formData.get("logoUrl") || "").trim();
    const buttonColor = String(formData.get("buttonColor") || "").trim();
    const headingColor = String(formData.get("headingColor") || "").trim();
    await prisma.shopSettings.upsert({
      where: { shop },
      update: { logoUrl: logoUrl || null, buttonColor: buttonColor || null, headingColor: headingColor || null },
      create: { shop, logoUrl: logoUrl || null, buttonColor: buttonColor || null, headingColor: headingColor || null },
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
  const [body, setBody] = useState(() => plainTextToHtml(item.body));
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
        </FormLayout>
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">Body</Text>
          <RichTextEditor initialContent={item.body} onChange={setBody} />
        </BlockStack>
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
  const brandingFetcher = useFetcher<{ ok?: boolean }>();
  const [hasKlaviyo, setHasKlaviyo] = useState(data.hasKlaviyo);
  const [apiKey, setApiKey] = useState("");
  const [senderName, setSenderName] = useState(data.senderName);
  const [logoUrl, setLogoUrl] = useState(data.logoUrl);
  const [buttonColor, setButtonColor] = useState(data.buttonColor);
  const [headingColor, setHeadingColor] = useState(data.headingColor);

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
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Branding</Text>
              <brandingFetcher.Form method="post">
                <input type="hidden" name="intent" value="save_branding" />
                <BlockStack gap="300">
                  <TextField
                    label="Logo"
                    autoComplete="off"
                    name="logoUrl"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    placeholder="https://cdn.shopify.com/s/files/…/logo.png"
                    helpText="Upload your logo to Shopify Admin > Content > Files, then paste the file URL here."
                  />
                  {logoUrl && (
                    <InlineStack align="start">
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        style={{ maxHeight: 64, maxWidth: 240, objectFit: "contain", borderRadius: 4, border: "1px solid #e1e3e5" }}
                      />
                    </InlineStack>
                  )}
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">Button colour</Text>
                    <InlineStack gap="300" blockAlign="center">
                      <input
                        type="color"
                        name="buttonColor"
                        value={buttonColor}
                        onChange={(e) => setButtonColor(e.target.value)}
                        style={{ width: 40, height: 32, padding: 2, border: "1px solid #c9cccf", borderRadius: 4, cursor: "pointer", background: "none" }}
                      />
                      <Text as="p" variant="bodySm" tone="subdued">{buttonColor}</Text>
                    </InlineStack>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">Heading colour</Text>
                    <InlineStack gap="300" blockAlign="center">
                      <input
                        type="color"
                        name="headingColor"
                        value={headingColor}
                        onChange={(e) => setHeadingColor(e.target.value)}
                        style={{ width: 40, height: 32, padding: 2, border: "1px solid #c9cccf", borderRadius: 4, cursor: "pointer", background: "none" }}
                      />
                      <Text as="p" variant="bodySm" tone="subdued">{headingColor}</Text>
                    </InlineStack>
                  </BlockStack>
                  <InlineStack align="end">
                    <Button submit variant="primary" loading={brandingFetcher.state !== "idle"}>
                      Save
                    </Button>
                  </InlineStack>
                </BlockStack>
              </brandingFetcher.Form>
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
