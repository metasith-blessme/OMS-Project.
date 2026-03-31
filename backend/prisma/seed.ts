import { OrderStatus, OrderChannel } from '@prisma/client'
import { OrderService } from '../src/services/order-service'
import { prisma } from '../src/lib/prisma'

async function main() {
  const toppings = [
    { code: 'POPPING_BARLEY', name: 'Popping Boba Barley' },
    { code: 'POPPING_RED_BEAN', name: 'Popping Boba Red Bean' },
    { code: 'POPPING_OAT', name: 'Popping Boba Oat' },
    { code: 'POPPING_STICKY_RICE', name: 'Popping Boba Sticky Rice' },
    { code: 'POPPING_SWEET_OSMANTHUS', name: 'Popping Boba Sweet Osmanthus' },
    { code: 'POPPING_CHESTNUT', name: 'Popping Boba Chestnut' },
  ]

  for (const topping of toppings) {
    // Create base physical product
    const product = await prisma.product.upsert({
      where: { code: topping.code },
      update: {},
      create: {
        code: topping.code,
        name: topping.name,
        baseStock: 500, // starting raw material stock
      },
    })
    
    // Create 1-pack variant (deducts 1 from baseStock)
    await prisma.productVariant.upsert({
      where: { sku: `${topping.code}_1` },
      update: {},
      create: {
        productId: product.id,
        sku: `${topping.code}_1`,
        name: `${topping.name} (1 Pack)`,
        packSize: 1,
      }
    })

    // Create 3-pack variant (deducts 3 from baseStock)
    await prisma.productVariant.upsert({
      where: { sku: `${topping.code}_3` },
      update: {},
      create: {
        productId: product.id,
        sku: `${topping.code}_3`,
        name: `${topping.name} (3 Pack)`,
        packSize: 3,
      }
    })

    console.log(`Created base product and variants for: ${product.name}`)
  }

  // Seed ChannelProduct mappings for Shopee testing
  const allVariants = await prisma.productVariant.findMany();
  for (const variant of allVariants) {
    await prisma.channelProduct.upsert({
      where: { channel_channelSku: { channel: 'SHOPEE', channelSku: `SHP-${variant.sku}` } },
      update: {},
      create: {
        channel: 'SHOPEE',
        channelSku: `SHP-${variant.sku}`,
        productVariantId: variant.id
      }
    });
  }
  console.log('Shopee channel product mappings seeded!');

  const barleyProduct = await prisma.product.findUnique({ where: { code: 'POPPING_BARLEY' } });
  const oatProduct = await prisma.product.findUnique({ where: { code: 'POPPING_OAT' } });

  if (barleyProduct && oatProduct) {
    const barley1 = await prisma.productVariant.findUnique({ where: { sku: 'POPPING_BARLEY_1' } });
    const oat1 = await prisma.productVariant.findUnique({ where: { sku: 'POPPING_OAT_1' } });

    if (barley1 && oat1) {
      // 1. Single Item (1 Unit)
      await OrderService.createOrder({
        channel: OrderChannel.SHOPEE,
        channelOrderId: 'SHOPEE-001',
        status: OrderStatus.PENDING,
        total: 150,
        items: [{ productVariantId: barley1.id, quantity: 1, price: 150 }]
      });

      // 2. Single SKU (2 Units)
      await OrderService.createOrder({
        channel: OrderChannel.TIKTOK,
        channelOrderId: 'TIKTOK-001',
        status: OrderStatus.PENDING,
        total: 300,
        items: [{ productVariantId: barley1.id, quantity: 2, price: 150 }]
      });

      // 3. Single SKU (3+ Units)
      await OrderService.createOrder({
        channel: OrderChannel.LINE,
        channelOrderId: 'LINE-001',
        status: OrderStatus.PENDING,
        total: 450,
        items: [{ productVariantId: barley1.id, quantity: 3, price: 150 }]
      });

      // 4. Mixed Items
      await OrderService.createOrder({
        channel: OrderChannel.SHOPEE,
        channelOrderId: 'SHOPEE-002',
        status: OrderStatus.PENDING,
        total: 300,
        items: [
          { productVariantId: barley1.id, quantity: 1, price: 150 },
          { productVariantId: oat1.id, quantity: 1, price: 150 }
        ]
      });
      console.log('Sample orders created using OrderService!');
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
