import { Router } from 'express';
import { prisma } from '../lib/prisma';

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

export default router;
