import crypto from 'crypto';

const secret = process.env.SHOPIFY_API_SECRET;
console.log('secret present:', !!secret, 'len:', (secret||'').length);

const orderId = Date.now();
const payload = {
  id: orderId,
  order_number: orderId,
  email: "qa-test-order@boko.com.au",
  customer: { id: 999000111 },
  financial_status: "paid",
  currency: "AUD",
  subtotal_price: "199.00",
  total_price: "169.15",
  total_discounts: "29.85",
  discount_codes: [ { code: "PRIYA15", amount: "29.85", type: "percentage" } ],
  note_attributes: [],
  line_items: [ { title: "Statement White Boots", price: "199.00", quantity: 1 } ],
};

const body = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

const res = await fetch('https://boko-influencer.replit.app/webhooks/orders/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Topic': 'orders/create',
    'X-Shopify-Hmac-Sha256': hmac,
    'X-Shopify-Shop-Domain': 'boko-reco-test-store.myshopify.com',
    'X-Shopify-Webhook-Id': 'qa-test-' + orderId,
    'X-Shopify-API-Version': '2024-10',
  },
  body,
});

console.log('Response status:', res.status);
console.log('Order ID used:', orderId);
const text = await res.text();
console.log('Response body:', text.slice(0, 500));
