import { Page, Layout, Card, Text, BlockStack, Button } from "@shopify/polaris";
import BokoBanner from "../components/admin/BokoBanner";

export default function SettingsIndex() {
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <BlockStack gap="600">
            <BokoBanner title="Settings" subtitle="Manage which program modules are active and how your emails are sent." />
            <Layout>
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Modules</Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Turn program modules on or off. Disabled modules are hidden from your navigation.
                    </Text>
                    <Button url="/app/settings/modules">Manage modules</Button>
                  </BlockStack>
                </Card>
              </Layout.Section>
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">Email settings</Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Connect Klaviyo, set your admin notification email, and customise the emails sent to you and your influencers.
                    </Text>
                    <Button url="/app/settings/emails">Manage emails</Button>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
