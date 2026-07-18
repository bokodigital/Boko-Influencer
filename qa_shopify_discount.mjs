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

// Get shop info + a product to confirm store is queryable
const shopInfo = await gql(`{ shop { name myshopifyDomain } }`);
console.log('Shop info:', JSON.stringify(shopInfo));

const products = await gql(`{ products(first: 3) { edges { node { id title variants(first:1){edges{node{id price}}} } } } }`);
console.log('Products:', JSON.stringify(products, null, 2));

process.exit(0);
