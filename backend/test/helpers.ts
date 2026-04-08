import { prisma } from '../src/lib/prisma';
import { OrderChannel, OrderStatus } from '@prisma/client';
import { OrderService } from '../src/services/order-service';

/**
 * Truncates every table that tests touch and re-seeds a minimal fixture:
 *  - 1 product (Popping Boba Barley) with baseStock = 100
 *  - 2 variants: 1-pack (packSize 1) and 3-pack (packSize 3)
 *
 * Returns the IDs needed by tests.
 */
export async function resetAndSeed() {
  // CASCADE handles FK ordering. Tables are ordered for clarity even though CASCADE
  // would let us do it in any order.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "test"."OrderItem", "test"."Order", "test"."InventoryLog", "test"."ChannelProduct", "test"."ProductVariant", "test"."Product" RESTART IDENTITY CASCADE`
  );

  const product = await prisma.product.create({
    data: {
      code: 'POPPING_BARLEY',
      name: 'Popping Boba Barley',
      baseStock: 100,
    },
  });

  const variant1 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: 'POPPING_BARLEY_1',
      name: 'Popping Boba Barley (1 Pack)',
      packSize: 1,
      keywords: ['บาร์เลย์'],
    },
  });

  const variant3 = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: 'POPPING_BARLEY_3',
      name: 'Popping Boba Barley (3 Pack)',
      packSize: 3,
      keywords: ['บาร์เลย์'],
    },
  });

  return { product, variant1, variant3 };
}

/**
 * Convenience: creates a PENDING SHOPEE order with one variant.
 */
export async function createPendingOrder(opts: {
  channelOrderId: string;
  variantId: string;
  quantity: number;
}) {
  return OrderService.createOrder({
    channel: OrderChannel.SHOPEE,
    channelOrderId: opts.channelOrderId,
    status: OrderStatus.PENDING,
    total: 0,
    items: [{ productVariantId: opts.variantId, quantity: opts.quantity, price: 0 }],
  });
}

/**
 * Reads current baseStock for a given product code.
 */
export async function getStock(productCode: string): Promise<number> {
  const p = await prisma.product.findUniqueOrThrow({ where: { code: productCode } });
  return p.baseStock;
}
