import { Text } from "@shopify/polaris";

export default function BokoBanner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
          {title}
        </Text>
        <Text as="p" tone="text-inverse" variant="bodySm">
          {subtitle}
        </Text>
      </div>
    </div>
  );
}
