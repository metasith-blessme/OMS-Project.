import { parse } from 'csv-parse/sync';

// Maps every known Thai/English Shopee Packing List column header to a canonical key
const COLUMN_MAP: Record<string, string> = {
  // Order ID
  'order id': 'orderId',
  'order sn': 'orderId',
  'order number': 'orderId',
  'หมายเลขคำสั่งซื้อ': 'orderId',
  'รหัสคำสั่งซื้อ': 'orderId',
  // SKU
  'sku': 'sku',
  'seller sku': 'sku',
  'sku ตัวเลือกสินค้า': 'sku',
  'รหัสสินค้า': 'sku',
  'sku reference no.': 'sku',
  'sku reference no': 'sku',
  // Quantity
  'quantity': 'quantity',
  'qty': 'quantity',
  'จำนวน': 'quantity',
  // Price
  'original price': 'price',
  'selling price': 'price',
  'price': 'price',
  'ราคาต่อหน่วย': 'price',
  'ราคา': 'price',
  // Tracking (not used for order creation but parsed for completeness)
  'tracking number': 'trackingNumber',
  'หมายเลขพัสดุ': 'trackingNumber',
  // Product / variation name (informational)
  'product name': 'productName',
  'ชื่อสินค้า': 'productName',
  'variation name': 'variationName',
  'ชื่อตัวเลือก': 'variationName',
  // Ship-by date
  'ship by date': 'shipByDate',
  'วันที่ควรจัดส่ง': 'shipByDate',
};

function normalizeHeader(header: string): string {
  return COLUMN_MAP[header.toLowerCase().trim()] ?? header.toLowerCase().trim();
}

interface ParsedShopeeRow {
  orderId: string;
  sku: string;
  quantity: number;
  price: number;
  shipByDate?: Date;
}

export interface ParsedShopeeOrder {
  orderId: string;
  shipByDate?: Date;
  items: { sku: string; quantity: number; price: number }[];
}

// Parses common Shopee date formats: "DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
function parseShopeeDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  let m = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00+07:00`);
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+07:00`);
  return undefined;
}

export class ShopeeCSVParser {
  static parse(buffer: Buffer): ParsedShopeeOrder[] {
    const rows: Record<string, string>[] = parse(buffer, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true, // handle UTF-8 BOM common in Shopee exports
    });

    // Group rows by orderId — Shopee emits one row per item variant
    const orderMap = new Map<string, ParsedShopeeRow[]>();

    for (const row of rows) {
      const orderId = row['orderId']?.trim();
      const sku = (row['sku'] ?? row['variationName'] ?? '').trim();
      const quantity = parseInt(row['quantity'] ?? '0', 10);
      const price = parseFloat(row['price'] ?? '0');
      const shipByDate = parseShopeeDate(row['shipByDate']);

      if (!orderId || !sku) continue; // skip malformed rows
      if (isNaN(quantity) || quantity <= 0) continue;

      const existing = orderMap.get(orderId) ?? [];
      existing.push({ orderId, sku, quantity, price: isNaN(price) ? 0 : price, shipByDate });
      orderMap.set(orderId, existing);
    }

    return Array.from(orderMap.entries()).map(([orderId, items]) => ({
      orderId,
      shipByDate: items.find(i => i.shipByDate)?.shipByDate,
      items: items.map(({ sku, quantity, price }) => ({ sku, quantity, price })),
    }));
  }
}
