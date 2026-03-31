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
  createdAt: string;
  orderItems: OrderItem[];
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
