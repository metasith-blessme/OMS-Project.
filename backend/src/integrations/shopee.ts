import crypto from 'crypto';
import axios from 'axios';
import { OrderChannel, OrderStatus, SyncStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { OrderService } from '../services/order-service';

const SHOPEE_API_BASE = process.env.SHOPEE_API_BASE || 'https://partner.shopeemobile.com';
const PARTNER_ID = parseInt(process.env.SHOPEE_PARTNER_ID || '0');
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || '';

interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  total_amount: number;
  create_time: number;
  item_list: {
    item_sku: string;
    model_sku?: string;
    model_quantity_purchased: number;
    model_original_price: number;
  }[];
}

export class ShopeeService {
  private static generateSign(path: string, timestamp: number, accessToken?: string, shopId?: number): string {
    let baseStr = `${PARTNER_ID}${path}${timestamp}`;
    if (accessToken) baseStr += accessToken;
    if (shopId) baseStr += shopId;
    
    return crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex');
  }

  static async getAccessToken(code: string, shopId: number) {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/public/get_access_token';
    const sign = this.generateSign(path, timestamp);

    const res = await axios.post(`${SHOPEE_API_BASE}${path}`, {
      code,
      partner_id: PARTNER_ID,
      shop_id: shopId,
    }, {
      params: { partner_id: PARTNER_ID, timestamp, sign }
    });

    if (res.data.error) throw new Error(`Shopee API Error: ${res.data.message}`);

    const { access_token, refresh_token, expire_in } = res.data;
    const expiresAt = new Date(Date.now() + expire_in * 1000);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    return await prisma.shopCredentials.upsert({
      where: { shopId: shopId.toString() },
      update: { accessToken: access_token, refreshToken: refresh_token, expiresAt, refreshExpiresAt },
      create: { 
        channel: OrderChannel.SHOPEE, 
        shopId: shopId.toString(), 
        accessToken: access_token, 
        refreshToken: refresh_token, 
        expiresAt, 
        refreshExpiresAt 
      }
    });
  }

  static async refreshAccessToken(shopId: string) {
    const creds = await prisma.shopCredentials.findUniqueOrThrow({ where: { shopId } });
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/public/refresh_access_token';
    const sign = this.generateSign(path, timestamp);

    const res = await axios.post(`${SHOPEE_API_BASE}${path}`, {
      refresh_token: creds.refreshToken,
      partner_id: PARTNER_ID,
      shop_id: parseInt(shopId),
    }, {
      params: { partner_id: PARTNER_ID, timestamp, sign }
    });

    if (res.data.error) throw new Error(`Shopee Refresh Error: ${res.data.message}`);

    const { access_token, refresh_token, expire_in } = res.data;
    const expiresAt = new Date(Date.now() + expire_in * 1000);

    return await prisma.shopCredentials.update({
      where: { shopId },
      data: { accessToken: access_token, refreshToken: refresh_token, expiresAt }
    });
  }

  static async syncOrders(shopId: string) {
    let creds = await prisma.shopCredentials.findUniqueOrThrow({ where: { shopId } });
    
    // Auto-refresh if expired (or expires in < 5 mins)
    if (creds.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      creds = await this.refreshAccessToken(shopId);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/order/get_order_list';
    const sign = this.generateSign(path, timestamp, creds.accessToken, parseInt(shopId));

    // Get READY_TO_SHIP orders from last 15 days
    const timeFrom = Math.floor(Date.now() / 1000) - 15 * 24 * 60 * 60;
    const res = await axios.get(`${SHOPEE_API_BASE}${path}`, {
      params: {
        partner_id: PARTNER_ID,
        timestamp,
        sign,
        access_token: creds.accessToken,
        shop_id: parseInt(shopId),
        time_range_field: 'create_time',
        time_from: timeFrom,
        time_to: timestamp,
        page_size: 50,
        order_status: 'READY_TO_SHIP'
      }
    });

    if (res.data.error) throw new Error(`Shopee Sync Error: ${res.data.message}`);

    const orderSnList = res.data.response.order_list.map((o: any) => o.order_sn);
    if (orderSnList.length === 0) return { synced: 0 };

    return await this.fetchAndSaveOrderDetails(shopId, orderSnList, creds.accessToken);
  }

  private static async fetchAndSaveOrderDetails(shopId: string, orderSnList: string[], accessToken: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/order/get_order_detail';
    const sign = this.generateSign(path, timestamp, accessToken, parseInt(shopId));

    const res = await axios.get(`${SHOPEE_API_BASE}${path}`, {
      params: {
        partner_id: PARTNER_ID,
        timestamp,
        sign,
        access_token: accessToken,
        shop_id: parseInt(shopId),
        order_sn_list: orderSnList.join(','),
        response_optional_fields: 'item_list,order_status,total_amount'
      }
    });

    const orders = res.data.response.order_list as ShopeeOrder[];
    let syncedCount = 0;

    for (const shopeeOrder of orders) {
      try {
        // Map Shopee items to internal variants
        const items = [];
        for (const item of shopeeOrder.item_list) {
          const sku = item.model_sku || item.item_sku;
          const channelProduct = await prisma.channelProduct.findUnique({
            where: { channel_channelSku: { channel: 'SHOPEE', channelSku: sku } }
          });

          if (!channelProduct) {
            console.error(`Unmapped Shopee SKU: ${sku} for order ${shopeeOrder.order_sn}`);
            continue;
          }

          items.push({
            productVariantId: channelProduct.productVariantId,
            quantity: item.model_quantity_purchased,
            price: item.model_original_price
          });
        }

        if (items.length === 0) continue;

        await OrderService.createOrder({
          channel: OrderChannel.SHOPEE,
          channelOrderId: shopeeOrder.order_sn,
          status: this.mapStatus(shopeeOrder.order_status),
          total: shopeeOrder.total_amount,
          items
        });
        syncedCount++;
      } catch (err) {
        console.error(`Failed to sync Shopee order ${shopeeOrder.order_sn}:`, err);
      }
    }

    return { synced: syncedCount };
  }

  private static mapStatus(shopeeStatus: string): OrderStatus {
    switch (shopeeStatus) {
      case 'READY_TO_SHIP': return OrderStatus.PENDING;
      case 'PROCESSED': return OrderStatus.PACKING;
      case 'SHIPPED':
      case 'COMPLETED': return OrderStatus.FINISHED;
      case 'CANCELLED': return OrderStatus.CANCELLED;
      default: return OrderStatus.PENDING;
    }
  }
}
