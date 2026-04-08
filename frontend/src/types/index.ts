export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  productVariant: ProductVariant;
}

export interface Order {
  id: string;
  channel: string;
  channelOrderId: string;
  status: string;
  category: string;
  shipByDate: string;
  packedBy?: string;
  totalQuantity: number;
  total: number;
  lineUserId?: string;
  slipReceived: boolean;
  slipReceivedAt?: string;
  createdAt: string;
  orderItems: OrderItem[];
}

export interface CreateOrderPayload {
  channel: 'LINE' | 'TIKTOK' | 'SHOPEE';
  channelOrderId: string;
  status: 'PENDING';
  total: number;
  items: { productVariantId: string; quantity: number; price: number }[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { reason: string; count: number; sampleOrderIds: string[] }[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  baseStock: number;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
