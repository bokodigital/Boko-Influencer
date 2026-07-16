const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.commissionRule.deleteMany({ where: { influencerId: null } });
  await prisma.commissionRule.create({
    data: { influencerId: null, type: "percentage", value: 10, appliesTo: "total_after_discount", active: true },
  });

  const influencersData = [
    { firstName: "Amara", lastName: "Okafor", email: "amara@styledbyamara.com", status: "approved", referralCode: "AMARA10", bio: "Sydney fashion and lifestyle creator, 42k followers." },
    { firstName: "Jack", lastName: "Sullivan", email: "jack@jacksullivanfit.com", status: "approved", referralCode: "JACKFIT", bio: "Fitness and activewear content creator." },
    { firstName: "Priya", lastName: "Nair", email: "priya@priyastyle.co", status: "pending", referralCode: "PRIYA15", bio: "Beauty and skincare micro-influencer, new applicant." },
    { firstName: "Leo", lastName: "Martins", email: "leo@leomartins.au", status: "pending", referralCode: "LEOMART", bio: "Streetwear and sneaker reviews." },
    { firstName: "Chloe", lastName: "Bennett", email: "chloe@chloebennett.com", status: "disabled", referralCode: "CHLOEB", bio: "Inactive since March, paused by request." },
  ];

  for (const data of influencersData) {
    await prisma.influencer.upsert({
      where: { email: data.email },
      update: {},
      create: { ...data, authUserId: "seed-" + data.referralCode },
    });
  }

  const amara = await prisma.influencer.findUnique({ where: { email: "amara@styledbyamara.com" } });
  const jack = await prisma.influencer.findUnique({ where: { email: "jack@jacksullivanfit.com" } });
  const rule = await prisma.commissionRule.findFirst({ where: { influencerId: null } });

  if (amara && jack && rule) {
    for (let i = 0; i < 3; i++) {
      const orderTotal = 120 + i * 45;
      const order = await prisma.order.create({
        data: {
          shopifyOrderId: "seed-order-" + amara.referralCode + "-" + i,
          influencerId: amara.id,
          orderTotal,
          discountCodeUsed: "AMARA10",
          currency: "AUD",
          orderStatus: i === 2 ? "refunded" : "paid",
        },
      });
      await prisma.commission.create({
        data: {
          orderId: order.id,
          influencerId: amara.id,
          commissionRuleId: rule.id,
          amount: orderTotal * 0.1,
          status: i === 0 ? "paid" : i === 2 ? "reversed" : "pending",
        },
      });
    }

    const order2 = await prisma.order.create({
      data: {
        shopifyOrderId: "seed-order-" + jack.referralCode + "-0",
        influencerId: jack.id,
        orderTotal: 260,
        discountCodeUsed: "JACKFIT",
        currency: "AUD",
        orderStatus: "paid",
      },
    });
    await prisma.commission.create({
      data: {
        orderId: order2.id,
        influencerId: jack.id,
        commissionRuleId: rule.id,
        amount: 26,
        status: "approved",
      },
    });

    await prisma.payout.create({
      data: {
        influencerId: amara.id,
        amount: 12,
        currency: "AUD",
        status: "completed",
        method: "bank_transfer",
        processedAt: new Date(),
        referenceNote: "Seed payout - March batch",
      },
    });
  }

  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
