import { useId, useState, type ReactNode } from "react";
import { Card, BlockStack, InlineStack, Text, Button, Collapsible } from "@shopify/polaris";

export default function HowToUse({
  title = "How to use this page",
  children,
  defaultOpen = false,
}: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="150" blockAlign="center">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "999px",
                background: "#BFFC00",
                fontWeight: 700,
                fontSize: "13px",
                color: "#000000",
                flexShrink: 0,
              }}
            >
              ?
            </div>
            <Text as="h3" variant="headingSm">
              {title}
            </Text>
          </InlineStack>
          <Button variant="plain" onClick={() => setOpen((prev) => !prev)}>
            {open ? "Hide" : "Show"}
          </Button>
        </InlineStack>
        <Collapsible
          open={open}
          id={id}
          transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
        >
          <div style={{ fontSize: "14px", color: "#616161" }}>{children}</div>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
