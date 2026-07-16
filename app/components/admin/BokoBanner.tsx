import { Text } from "@shopify/polaris";

const BOKO_LIME = "#BFFC00";

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
      <div style={{ background: BOKO_LIME, borderRadius: "6px", padding: "6px", display: "flex" }}>
        <svg viewBox="2176 -2073.2 4652.3 4447.2" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#000000"
            d="M3916.2,1378.9c-20.7,0-41.4-1-61.6-2.9L6548-1312.1l-580.3-579.1L3274.4,796.9c-2-20.3-2.9-40.8-2.9-61.5v-2632.7h-820.7
            V735.5c0,807.8,655.9,1462.6,1465.2,1462.6h2637.6V1379H3916.2V1378.9z"
          />
        </svg>
      </div>
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
