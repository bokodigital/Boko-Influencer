import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const influencer = await p.influencer.findFirst({ where: { firstName: 'Priya' } });
if (!influencer) { console.log('No influencer found'); process.exit(1); }
console.log('Influencer:', influencer.id, influencer.firstName, influencer.lastName, influencer.email);

const rule = await p.commissionRule.create({
  data: {
    influencerId: influencer.id,
    type: 'percentage',
    value: 10,
    appliesTo: 'total_after_discount',
    active: true,
  }
});
console.log('CommissionRule created:', rule.id, rule.type, rule.value);

const code = await p.discountCode.upsert({
  where: { code: 'PRIYA15' },
  update: { active: true, influencerId: influencer.id },
  create: {
    influencerId: influencer.id,
    code: 'PRIYA15',
    type: 'percentage',
    value: 15,
    active: true,
  }
});
console.log('DiscountCode:', code.id, code.code, code.value, code.active);

process.exit(0);
