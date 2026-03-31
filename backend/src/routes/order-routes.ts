import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus, OrderChannel } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { OrderService } from '../services/order-service';
import { validate } from '../middleware/validate';

const router = Router();

const createOrderSchema = z.object({
  channel: z.nativeEnum(OrderChannel),
  channelOrderId: z.string().min(1),
  status: z.nativeEnum(OrderStatus),
  total: z.number().nonnegative(),
  items: z.array(z.object({
    productVariantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative(),
  })).min(1),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  packedBy: z.string().min(1).optional(),
}).refine(
  (data) => data.status !== 'PACKING' || !!data.packedBy,
  { message: 'packedBy is required when starting packing', path: ['packedBy'] }
);

const batchUpdateStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order ID required'),
  status: z.nativeEnum(OrderStatus),
  packedBy: z.string().min(1).optional(),
}).refine(
  (data) => data.status !== 'PACKING' || !!data.packedBy,
  { message: 'packedBy is required when starting packing', path: ['packedBy'] }
);

router.post('/', validate(createOrderSchema), async (req, res, next) => {
  try {
    const order = await OrderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const where = {
      OR: [
        { status: { not: OrderStatus.FINISHED as OrderStatus } },
        {
          status: OrderStatus.FINISHED,
          finishedAt: { gte: sevenDaysAgo }
        }
      ]
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: { productVariant: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

// IMPORTANT: /batch/status must be defined BEFORE /:id/status
// otherwise Express matches "batch" as the :id parameter
router.patch('/batch/status', validate(batchUpdateStatusSchema), async (req, res, next) => {
  try {
    const { orderIds, status, packedBy } = req.body as {
      orderIds: string[];
      status: OrderStatus;
      packedBy?: string;
    };

    const results: { orderId: string; success: boolean; channelOrderId?: string }[] = [];
    const errors: { orderId: string; error: string }[] = [];

    for (const orderId of orderIds) {
      try {
        const updated = await OrderService.updateOrderStatus(orderId, status, packedBy);
        results.push({ orderId, success: true, channelOrderId: updated.channelOrderId });
      } catch (err: unknown) {
        errors.push({ orderId, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ results, errors });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', validate(updateStatusSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status, packedBy } = req.body as { status: OrderStatus; packedBy?: string };
    const updatedOrder = await OrderService.updateOrderStatus(id, status, packedBy);
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

export default router;
