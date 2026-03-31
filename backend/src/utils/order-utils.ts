import { OrderCategory } from '@prisma/client';

const BUSINESS_TIMEZONE = 'Asia/Bangkok';
const CUTOFF_HOUR = 12;

export function getShipByDate(orderDate: Date): Date {
  const bangkokHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(orderDate),
    10
  );

  const shipByDate = new Date(orderDate);
  if (bangkokHour >= CUTOFF_HOUR) {
    shipByDate.setDate(shipByDate.getDate() + 1);
  }
  return shipByDate;
}

export function getOrderCategory(items: { productVariantId: string; quantity: number }[]): {
  category: OrderCategory;
  totalQuantity: number;
} {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueSkus = new Set(items.map(item => item.productVariantId)).size;

  if (uniqueSkus > 1) {
    return { category: OrderCategory.MIXED, totalQuantity };
  }

  if (totalQuantity === 1) {
    return { category: OrderCategory.ONE_ITEM, totalQuantity };
  }

  if (totalQuantity === 2) {
    return { category: OrderCategory.TWO_ITEMS, totalQuantity };
  }

  return { category: OrderCategory.THREE_PLUS, totalQuantity };
}
