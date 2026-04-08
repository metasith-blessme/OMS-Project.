import { OrderStatus, OrderChannel, OrderCategory } from '@prisma/client';
import { getOrderCategory, getShipByDate } from '../utils/order-utils';
import { prisma } from '../lib/prisma';

// Valid state transitions map
// FINISHED → CANCELLED represents a customer return / refund — stock is restored.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['PACKING', 'CANCELLED'],
  PACKING:   ['FINISHED', 'PENDING', 'CANCELLED'],
  FINISHED:  ['PACKING', 'PENDING', 'CANCELLED'],
  CANCELLED: ['PENDING'],
};

export class OrderService {
  static async createOrder(data: {
    channel: OrderChannel;
    channelOrderId: string;
    status: OrderStatus;
    total: number;
    items: { productVariantId: string; quantity: number; price: number }[];
    shipByDate?: Date;
  }) {
    const { category, totalQuantity } = getOrderCategory(data.items);
    const createdAt = new Date();
    const shipByDate = data.shipByDate ?? getShipByDate(createdAt);

    return await prisma.$transaction(async (tx) => {
      // Pure create — duplicates throw P2002 so callers can decide whether to skip or surface.
      // Earlier this was an upsert, which silently overwrote existing PACKING orders without
      // restoring their already-deducted inventory and left stock in an inconsistent state.
      const order = await tx.order.create({
        data: {
          channel: data.channel,
          channelOrderId: data.channelOrderId,
          status: data.status,
          category,
          totalQuantity,
          total: data.total,
          shipByDate,
          createdAt,
          orderItems: {
            create: data.items.map(item => ({
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        },
        include: {
          orderItems: true
        }
      });

      return order;
    });
  }

  static async updateOrderStatus(orderId: string, newStatus: OrderStatus, packedBy?: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              productVariant: true
            }
          }
        }
      });

      if (!order) throw new Error('Order not found');

      // Validate state transition
      const allowed = VALID_TRANSITIONS[order.status];
      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid transition from ${order.status} to ${newStatus}`);
      }

      // Concurrency guard: prevent stealing a PACKING order
      if (order.status === 'PACKING' && order.packedBy && packedBy && order.packedBy !== packedBy) {
        if (newStatus === 'FINISHED') {
          throw new Error(`Order is being packed by ${order.packedBy}. Only they can finish it.`);
        }
      }

      const updateData: Partial<{
        status: OrderStatus;
        packedBy: string | null;
        packedAt: Date | null;
        finishedAt: Date | null;
      }> = { status: newStatus };

      // Determine if we need to deduct or restore inventory
      const needsDeduction = newStatus === 'PACKING' && order.status === 'PENDING';
      const needsRestoration =
        (newStatus === 'PENDING' || newStatus === 'CANCELLED') &&
        (order.status === 'PACKING' || order.status === 'FINISHED');

      if (needsDeduction) {
        updateData.packedBy = packedBy ?? null;
        updateData.packedAt = new Date();

        for (const item of order.orderItems) {
          const totalDeduction = item.quantity * item.productVariant.packSize;

          // Check sufficient stock
          const product = await tx.product.findUniqueOrThrow({
            where: { id: item.productVariant.productId }
          });
          if (product.baseStock < totalDeduction) {
            throw new Error(`Insufficient stock for ${product.name} (need ${totalDeduction}, have ${product.baseStock})`);
          }

          await tx.product.update({
            where: { id: item.productVariant.productId },
            data: { baseStock: { decrement: totalDeduction } }
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productVariant.productId,
              change: -totalDeduction,
              reason: 'ORDER_PACKING_STARTED',
              referenceId: order.id
            }
          });
        }
      } else if (needsRestoration) {
        updateData.packedBy = null;
        updateData.packedAt = null;
        updateData.finishedAt = null;

        const reason = newStatus === 'CANCELLED'
          ? 'ORDER_CANCELLED'
          : 'ORDER_STATUS_REVERTED_TO_PENDING';

        for (const item of order.orderItems) {
          const totalRestoration = item.quantity * item.productVariant.packSize;
          await tx.product.update({
            where: { id: item.productVariant.productId },
            data: { baseStock: { increment: totalRestoration } }
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productVariant.productId,
              change: totalRestoration,
              reason,
              referenceId: order.id
            }
          });
        }
      } else if (newStatus === 'FINISHED') {
        updateData.finishedAt = new Date();
      } else if (newStatus === 'PACKING' && order.status === 'FINISHED') {
        updateData.finishedAt = null;
        updateData.packedBy = packedBy ?? order.packedBy;
      }

      return await tx.order.update({
        where: { id: orderId },
        data: updateData
      });
    });
  }
}
