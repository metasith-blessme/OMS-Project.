import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { variants: true }
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

const updateStockSchema = z.object({
  baseStock: z.number().int().nonnegative(),
  reason: z.string().min(1).max(100).optional(),
});

// Manual stock adjustment. Writes an InventoryLog row capturing the delta so
// every change to baseStock is auditable.
router.patch('/:id/stock', validate(updateStockSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { baseStock, reason } = req.body as { baseStock: number; reason?: string };

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) throw new Error('Product not found');

      const delta = baseStock - product.baseStock;
      const next = await tx.product.update({
        where: { id },
        data: { baseStock },
      });

      if (delta !== 0) {
        await tx.inventoryLog.create({
          data: {
            productId: id,
            change: delta,
            reason: reason || 'MANUAL_ADJUSTMENT',
          },
        });
      }

      return next;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
