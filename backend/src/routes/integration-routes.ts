import { Router } from 'express';
import { ShopeeService } from '../integrations/shopee';

const router = Router();

/**
 * Shopee OAuth Callback
 * Shopee redirects here after seller authorization with ?code=...&shop_id=...
 */
router.get('/shopee/callback', async (req, res, next) => {
  try {
    const { code, shop_id } = req.query;
    if (!code || !shop_id) {
      return res.status(400).json({ error: 'Missing code or shop_id' });
    }

    await ShopeeService.getAccessToken(code as string, parseInt(shop_id as string));
    
    // In a real app, redirect to a frontend "Integration Success" page
    res.json({ message: 'Shopee shop authorized successfully', shopId: shop_id });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger Manual Sync for a Shop
 */
router.post('/sync/:shopId', async (req, res, next) => {
  try {
    const { shopId } = req.params;
    const result = await ShopeeService.syncOrders(shopId);
    res.json({ message: 'Sync completed', ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
