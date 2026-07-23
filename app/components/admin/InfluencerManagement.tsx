import { useState, useCallback, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import HowToUse from "./HowToUse";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Button,
  Modal,
  FormLayout,
  TextField,
  Text,
  EmptyState,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";


const STATUS_TONE: Record<string, "success" | "attention" | "critical" | "info"> = {
  approved: "success",
  pending: "attention",
  rejected: "critical",
  disabled: "critical",
};

type Influencer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  referralCode: string;
  bio: string | null;
  createdAt: string;
};

export default function InfluencerManagement({ influencers, registerUrl }: { influencers: Influencer[]; registerUrl: string }) {
  const createFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const statusFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", referralCode: "" });

  const embedCode = `<iframe src="${registerUrl}" title="Join our influencer program" style="width:100%;max-width:600px;height:600px;border:0;"></iframe>`;

  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (createFetcher.state === "idle" && createFetcher.data?.ok) {
      setModalOpen(false);
      setForm({ firstName: "", lastName: "", email: "", referralCode: "" });
    }
  }, [createFetcher.state, createFetcher.data]);

  const updateStatus = (influencerId: string, status: string) => {
    statusFetcher.submit(
      { influencerId, status },
      { method: "post", action: "/api/admin/influencers/status" }
    );
  };

  const deleteInfluencer = (influencerId: string, name: string) => {
    if (!window.confirm("Permanently delete " + name + " and ALL their data (referrals, clicks, orders, commissions, rewards, payouts, bank details)? This cannot be undone.")) return;
    deleteFetcher.submit(
      { influencerId },
      { method: "post", action: "/api/admin/influencers/delete" }
    );
  };

  const rows = influencers.map((inf, index) => (
    <IndexTable.Row id={inf.id} key={inf.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {inf.firstName} {inf.lastName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{inf.email}</IndexTable.Cell>
      <IndexTable.Cell>{inf.referralCode}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[inf.status] || "info"}>{inf.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {inf.status !== "approved" && (
            <Button size="slim" onClick={() => updateStatus(inf.id, "approved")}>
              Approve
            </Button>
          )}
          {inf.status !== "rejected" && inf.status !== "disabled" && (
            <Button size="slim" tone="critical" onClick={() => updateStatus(inf.id, "rejected")}>
              Reject
            </Button>
          )}
          {inf.status === "approved" && (
            <Button size="slim" tone="critical" variant="tertiary" onClick={() => updateStatus(inf.id, "disabled")}>
              Disable
            </Button>
          )}
            <Button size="slim" tone="critical" onClick={() => deleteInfluencer(inf.id, inf.firstName + " " + inf.lastName)}>Delete permanently</Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Influencers"
      fullWidth
      primaryAction={{ content: "Add influencer", onAction: () => setModalOpen(true) }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 20px",
                background: "#000000",
                borderRadius: "8px",
              }}
            >

              <div>
                <Text as="p" fontWeight="bold" tone="text-inverse">
                  Influencer Rewards by Boko program
                </Text>
                <Text as="p" tone="text-inverse" variant="bodySm">
                  {influencers.length} total influencer{influencers.length === 1 ? "" : "s"} &middot;{" "}
                  {influencers.filter((i) => i.status === "approved").length} approved &middot;{" "}
                  {influencers.filter((i) => i.status === "pending").length} pending review
                </Text>
              </div>
            </div>
            <HowToUse title="Instructions for the Influencer module"><ul style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: "1.7" }}><li>Click Add influencer to create one manually.</li><li><strong>Let influencers sign up themselves:</strong> share your sign-up link, or embed the sign-up form directly on your website using the embed code below.</li><li>Approve applicants who registered through your link or embedded form (they show as Pending).</li><li>Set status to Approved to activate their account and referral link.</li><li>Use the table to edit details, view the referral code, or change status.</li><li>Rejected or Disabled influencers keep their history but cannot earn new commissions.</li><li><strong>Delete permanently</strong> removes an influencer and ALL their data (referrals, clicks, orders, commissions, rewards, payouts and bank details). This cannot be undone.</li></ul></HowToUse>
        <Card>
          <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Your influencer sign-up link</div>
          <div style={{ fontSize: "13px", color: "#616161", marginBottom: "8px" }}>Share this link with influencers so they can apply. Applications appear below as Pending for you to approve.</div>
          <div style={{ fontSize: "13px", background: "#F1F1F1", padding: "8px 10px", borderRadius: "6px", wordBreak: "break-all", fontFamily: "monospace" }}>{registerUrl}</div>

          <div style={{ fontWeight: 600, fontSize: "14px", margin: "18px 0 4px" }}>Embed the sign-up form on your website</div>
          <div style={{ fontSize: "13px", color: "#616161", marginBottom: "8px" }}>Paste this code into any page of your website (or your Shopify theme via a Custom Liquid / HTML block) to show the application form inline. Submissions appear below as Pending.</div>
          <div style={{ fontSize: "12px", background: "#F1F1F1", padding: "10px 12px", borderRadius: "6px", wordBreak: "break-all", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{embedCode}</div>
        </Card>

            <Card padding="0">
            {influencers.length === 0 ? (
              <div style={{ padding: "24px" }}>
                <EmptyState
                  heading="No influencers yet"
                  action={{ content: "Add influencer", onAction: () => setModalOpen(true) }}
                  image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                >
                  <p>Add your first influencer to start tracking referrals and commissions.</p>
                </EmptyState>
              </div>
            ) : (
              <IndexTable
                itemCount={influencers.length}
                headings={[
                  { title: "Name" },
                  { title: "Email" },
                  { title: "Referral code" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rows}
              </IndexTable>
            )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Add influencer"
        primaryAction={{
          content: "Add influencer",
          loading: createFetcher.state !== "idle",
          onAction: () => {
            createFetcher.submit(form, { method: "post" });
          },
        }}
        secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
      >
        <Modal.Section>
          {createFetcher.data?.error && (
            <div style={{ marginBottom: "12px" }}>
              <Text as="p" tone="critical">
                {createFetcher.data.error}
              </Text>
            </div>
          )}
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="First name"
                autoComplete="off"
                value={form.firstName}
                onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
              />
              <TextField
                label="Last name"
                autoComplete="off"
                value={form.lastName}
                onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              />
            </FormLayout.Group>
            <TextField
              label="Email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <TextField
              label="Referral code"
              autoComplete="off"
              helpText="Shown to customers as a discount / attribution code, e.g. AMARA10"
              value={form.referralCode}
              onChange={(v) => setForm((f) => ({ ...f, referralCode: v.toUpperCase() }))}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
