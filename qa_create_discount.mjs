import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const session = await p.session.findFirst({ where: { shop: 'boko-reco-test-store.myshopify.com' } });
const shop = session.shop;
const token = session.accessToken;

async function gql(query, variables) {
  const res = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const mutation = `mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { title codes(first:5){nodes{code}} } } }
    userErrors { field message code }
  }
}`;

const variables = {
  basicCodeDiscount: {
    title: "PRIYA15 - Priya Nair Influencer Code",
    code: "PRIYA15",
    startsAt: new Date().toISOString(),
    customerSelection: { all: true },
    customerGets: {
      value: { percentage: 0.15 },
      items: { all: true }
    },
    appliesOncePerCustomer: false,
  }
};

const result = await gql(mutation, variables);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
