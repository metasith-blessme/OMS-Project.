import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { OrderService } from '../src/services/order-service';
import { prisma } from '../src/lib/prisma';
import { resetAndSeed, createPendingOrder, getStock } from './helpers';
import { OrderChannel, OrderStatus } from '@prisma/client';

describe('OrderService', () => {
  let variant1Id: string;
  let variant3Id: string;

  beforeEach(async () => {
    const seeded = await resetAndSeed();
    variant1Id = seeded.variant1.id;
    variant3Id = seeded.variant3.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── createOrder ───────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates a PENDING order without touching inventory', async () => {
      const stockBefore = await getStock('POPPING_BARLEY');
      await createPendingOrder({ channelOrderId: 'TEST-001', variantId: variant1Id, quantity: 2 });
      const stockAfter = await getStock('POPPING_BARLEY');
      expect(stockAfter).toBe(stockBefore); // unchanged — deduction happens at PACKING
    });

    it('throws on duplicate channelOrderId (the upsert footgun fix)', async () => {
      await createPendingOrder({ channelOrderId: 'TEST-DUP', variantId: variant1Id, quantity: 1 });
      await expect(
        createPendingOrder({ channelOrderId: 'TEST-DUP', variantId: variant1Id, quantity: 1 })
      ).rejects.toThrow();
    });

    it('respects an explicit shipByDate when provided', async () => {
      const expected = new Date('2026-12-25T00:00:00+07:00');
      const order = await OrderService.createOrder({
        channel: OrderChannel.SHOPEE,
        channelOrderId: 'TEST-DATE',
        status: OrderStatus.PENDING,
        total: 0,
        shipByDate: expected,
        items: [{ productVariantId: variant1Id, quantity: 1, price: 0 }],
      });
      expect(order.shipByDate.toISOString()).toBe(expected.toISOString());
    });

    it('categorises 1 SKU x 1 unit as ONE_ITEM', async () => {
      const order = await createPendingOrder({ channelOrderId: 'CAT-1', variantId: variant1Id, quantity: 1 });
      expect(order.category).toBe('ONE_ITEM');
    });

    it('categorises 1 SKU x 3 units as THREE_PLUS', async () => {
      const order = await createPendingOrder({ channelOrderId: 'CAT-3', variantId: variant1Id, quantity: 3 });
      expect(order.category).toBe('THREE_PLUS');
    });
  });

  // ─── PENDING → PACKING (inventory deduction) ───────────────────────────────

  describe('PENDING → PACKING', () => {
    it('deducts inventory by quantity * packSize', async () => {
      const order = await createPendingOrder({ channelOrderId: 'PACK-1', variantId: variant3Id, quantity: 2 });
      const stockBefore = await getStock('POPPING_BARLEY');
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      const stockAfter = await getStock('POPPING_BARLEY');
      expect(stockBefore - stockAfter).toBe(2 * 3); // qty * packSize
    });

    it('writes an InventoryLog row with the correct change', async () => {
      const order = await createPendingOrder({ channelOrderId: 'LOG-1', variantId: variant1Id, quantity: 4 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      const log = await prisma.inventoryLog.findFirst({
        where: { referenceId: order.id, reason: 'ORDER_PACKING_STARTED' },
      });
      expect(log).not.toBeNull();
      expect(log!.change).toBe(-4);
    });

    it('records packedBy and packedAt', async () => {
      const order = await createPendingOrder({ channelOrderId: 'BY-1', variantId: variant1Id, quantity: 1 });
      const updated = await OrderService.updateOrderStatus(order.id, 'PACKING', 'Bob');
      expect(updated.packedBy).toBe('Bob');
      expect(updated.packedAt).not.toBeNull();
    });

    it('throws when stock is insufficient and rolls back the transaction', async () => {
      // baseStock starts at 100. Create an order needing 200.
      const order = await createPendingOrder({ channelOrderId: 'OVER-1', variantId: variant3Id, quantity: 70 }); // 70*3 = 210 > 100
      await expect(
        OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice')
      ).rejects.toThrow(/Insufficient stock/);
      // Order must NOT have moved out of PENDING
      const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(after.status).toBe('PENDING');
      // Stock must be unchanged
      expect(await getStock('POPPING_BARLEY')).toBe(100);
    });
  });

  // ─── PACKING → FINISHED ────────────────────────────────────────────────────

  describe('PACKING → FINISHED', () => {
    it('sets finishedAt and does not change inventory', async () => {
      const order = await createPendingOrder({ channelOrderId: 'FIN-1', variantId: variant1Id, quantity: 5 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      const stockMid = await getStock('POPPING_BARLEY');
      const finished = await OrderService.updateOrderStatus(order.id, 'FINISHED', 'Alice');
      expect(finished.finishedAt).not.toBeNull();
      expect(await getStock('POPPING_BARLEY')).toBe(stockMid);
    });

    it('blocks a different employee from finishing someone elses PACKING order', async () => {
      const order = await createPendingOrder({ channelOrderId: 'STEAL-1', variantId: variant1Id, quantity: 1 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      await expect(
        OrderService.updateOrderStatus(order.id, 'FINISHED', 'Bob')
      ).rejects.toThrow(/being packed by Alice/);
    });
  });

  // ─── Reverts and cancellation (inventory restoration) ──────────────────────

  describe('PACKING → PENDING (revert)', () => {
    it('restores inventory and clears packedBy/packedAt', async () => {
      const order = await createPendingOrder({ channelOrderId: 'REV-1', variantId: variant3Id, quantity: 4 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      expect(await getStock('POPPING_BARLEY')).toBe(100 - 12);
      const reverted = await OrderService.updateOrderStatus(order.id, 'PENDING');
      expect(await getStock('POPPING_BARLEY')).toBe(100);
      expect(reverted.packedBy).toBeNull();
      expect(reverted.packedAt).toBeNull();
    });
  });

  describe('FINISHED → CANCELLED (return / refund)', () => {
    it('restores inventory even from FINISHED state', async () => {
      const order = await createPendingOrder({ channelOrderId: 'RET-1', variantId: variant3Id, quantity: 2 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      await OrderService.updateOrderStatus(order.id, 'FINISHED', 'Alice');
      expect(await getStock('POPPING_BARLEY')).toBe(100 - 6);
      await OrderService.updateOrderStatus(order.id, 'CANCELLED');
      expect(await getStock('POPPING_BARLEY')).toBe(100);
    });

    it('writes an ORDER_CANCELLED inventory log', async () => {
      const order = await createPendingOrder({ channelOrderId: 'RET-LOG', variantId: variant1Id, quantity: 3 });
      await OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice');
      await OrderService.updateOrderStatus(order.id, 'FINISHED', 'Alice');
      await OrderService.updateOrderStatus(order.id, 'CANCELLED');
      const log = await prisma.inventoryLog.findFirst({
        where: { referenceId: order.id, reason: 'ORDER_CANCELLED' },
      });
      expect(log).not.toBeNull();
      expect(log!.change).toBe(3);
    });
  });

  describe('PENDING → CANCELLED (no inventory was deducted)', () => {
    it('cancels without touching inventory or writing a restoration log', async () => {
      const order = await createPendingOrder({ channelOrderId: 'EARLY-CAN', variantId: variant1Id, quantity: 5 });
      const stockBefore = await getStock('POPPING_BARLEY');
      await OrderService.updateOrderStatus(order.id, 'CANCELLED');
      const stockAfter = await getStock('POPPING_BARLEY');
      expect(stockAfter).toBe(stockBefore);
      // No inventory log should exist for this order — nothing was deducted
      const log = await prisma.inventoryLog.findFirst({ where: { referenceId: order.id } });
      expect(log).toBeNull();
    });
  });

  // ─── Invalid transitions ───────────────────────────────────────────────────

  describe('invalid transitions', () => {
    it('rejects PENDING → FINISHED (must go through PACKING)', async () => {
      const order = await createPendingOrder({ channelOrderId: 'INV-1', variantId: variant1Id, quantity: 1 });
      await expect(
        OrderService.updateOrderStatus(order.id, 'FINISHED', 'Alice')
      ).rejects.toThrow(/Invalid transition/);
    });

    it('rejects CANCELLED → PACKING (must go to PENDING first)', async () => {
      const order = await createPendingOrder({ channelOrderId: 'INV-2', variantId: variant1Id, quantity: 1 });
      await OrderService.updateOrderStatus(order.id, 'CANCELLED');
      await expect(
        OrderService.updateOrderStatus(order.id, 'PACKING', 'Alice')
      ).rejects.toThrow(/Invalid transition/);
    });
  });
});
