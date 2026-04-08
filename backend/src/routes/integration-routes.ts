import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import { OrderChannel, OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { OrderService } from '../services/order-service';
import { ShopeeCSVParser } from '../integrations/shopee-csv';
import { ShopeePDFParser, matchVariantByKeywords } from '../integrations/shopee-pdf';
import { LineService } from '../integrations/line';
import { dedupeErrors, RawImportError } from '../utils/import-result';

const router = Router();

// ─── Shopee: CSV Packing List Upload ────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

router.post('/shopee/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parsedOrders = ShopeeCSVParser.parse(req.file.buffer);
    let created = 0;
    let skipped = 0;
    const errors: RawImportError[] = [];

    for (const parsedOrder of parsedOrders) {
      try {
        // Skip duplicates outright — re-importing must NEVER overwrite an in-flight order.
        const existing = await prisma.order.findUnique({
          where: { channelOrderId: parsedOrder.orderId },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Resolve all items to internal productVariantIds
        const resolvedItems: { productVariantId: string; quantity: number; price: number }[] = [];
        let hasUnmappedSku = false;

        for (const item of parsedOrder.items) {
          const channelProduct = await prisma.channelProduct.findUnique({
            where: { channel_channelSku: { channel: 'SHOPEE', channelSku: item.sku } },
          });

          if (!channelProduct) {
            errors.push({ orderId: parsedOrder.orderId, reason: `Unknown SKU: ${item.sku}` });
            hasUnmappedSku = true;
            break;
          }

          resolvedItems.push({
            productVariantId: channelProduct.productVariantId,
            quantity: item.quantity,
            price: item.price,
          });
        }

        if (hasUnmappedSku) continue;

        const total = resolvedItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

        await OrderService.createOrder({
          channel: OrderChannel.SHOPEE,
          channelOrderId: parsedOrder.orderId,
          status: OrderStatus.PENDING,
          total,
          shipByDate: parsedOrder.shipByDate,
          items: resolvedItems,
        });
        created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ orderId: parsedOrder.orderId, reason: message });
      }
    }

    res.json({ created, skipped, errors: dedupeErrors(errors) });
  } catch (error) {
    next(error);
  }
});

// ─── Shopee: PDF Packing List Upload ────────────────────────────────────────

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — packing list PDFs can be larger than CSVs
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

router.post('/shopee/upload-pdf', uploadPdf.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parsedOrders = await ShopeePDFParser.parse(req.file.buffer);

    // Load all variants once for keyword matching
    const variants = await prisma.productVariant.findMany({
      select: { id: true, productId: true, packSize: true, keywords: true },
    });

    let created = 0;
    let skipped = 0;
    const errors: RawImportError[] = [];

    for (const parsedOrder of parsedOrders) {
      try {
        const existing = await prisma.order.findUnique({
          where: { channelOrderId: parsedOrder.orderId },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const resolvedItems: { productVariantId: string; quantity: number; price: number }[] = [];
        let hasUnmatched = false;

        for (const item of parsedOrder.items) {
          const match = matchVariantByKeywords(item.rawName, variants);
          if (match.variantId === null) {
            errors.push({ orderId: parsedOrder.orderId, reason: match.reason });
            hasUnmatched = true;
            break;
          }
          resolvedItems.push({
            productVariantId: match.variantId,
            quantity: item.quantity,
            price: 0, // PDF does not contain price information
          });
        }

        if (hasUnmatched || resolvedItems.length === 0) continue;

        await OrderService.createOrder({
          channel: OrderChannel.SHOPEE,
          channelOrderId: parsedOrder.orderId,
          status: OrderStatus.PENDING,
          total: 0,
          shipByDate: parsedOrder.shipByDate ?? undefined,
          items: resolvedItems,
        });
        created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ orderId: parsedOrder.orderId, reason: message });
      }
    }

    res.json({ created, skipped, errors: dedupeErrors(errors) });
  } catch (error) {
    next(error);
  }
});

// ─── Line OA: Webhook ────────────────────────────────────────────────────────

router.post(
  '/line/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Line requires a 200 response within 3 seconds — send it immediately
    res.status(200).end();

    const signature = req.headers['x-line-signature'] as string;
    if (!signature || !LineService.validateSignature(req.body as Buffer, signature)) {
      console.warn('Line webhook: invalid signature, ignoring');
      return;
    }

    try {
      const { events } = JSON.parse((req.body as Buffer).toString());
      await LineService.handleEvents(events ?? []);
    } catch (err) {
      console.error('Line webhook processing error:', err);
    }
  }
);

export default router;
