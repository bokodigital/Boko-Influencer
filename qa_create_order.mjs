import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const session = await p.session.findFirst({ where: { shop: 'boko-reco-test-store.myshopify.com' } });
const shop = session.shop;
const token = session.accessToken;

const orderPayload = {
  order: {
    line_items: [
      { title: "Statement White Boots", price: "199.00", quantity: 1 }
    ],
    customer: { first_name: "QA", last_name: "Tester", email: "qa-test-order@boko.com.au" },
    email: "qa-test-order@boko.com.au",
    financial_status: "paid",
    currency: "AUD",
    discount_codes: [
      { code: "PRIYA15", amount: "29.85", type: "percentage" }
    ],
    total_discounts: "29.85",
    test: true,
    send_receipt: false,
    send_fulfillment_receipt: false,
  }
};

const res = await fetch(`https://${shop}/admin/api/2024-10/orders.json`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
  body: JSON.stringify(orderPayload),
});
const json = await res.json();
console.log('Status:', res.status);
console.log(JSON.stringify(json, null, 2));
process.exit(0);
