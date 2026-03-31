'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, Product, Toast } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 5000;

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchData = useCallback(async (silent = false, page = 1, limit = 50) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/api/orders?page=${page}&limit=${limit}`),
        fetch(`${API_URL}/api/products`)
      ]);

      if (!ordersRes.ok || !productsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const ordersJson = await ordersRes.json();
      const productsData = await productsRes.json();
      
      // Support both paginated and non-paginated responses
      if (ordersJson.data) {
        setOrders(ordersJson.data);
        if (ordersJson.pagination) {
          setPagination(ordersJson.pagination);
        }
      } else {
        setOrders(ordersJson);
      }
      
      setProducts(productsData);
    } catch (err) {
      if (!silent) addToast('error', 'Failed to connect to server');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Initial fetch + polling
  useEffect(() => {
    fetchData(false, pagination.page, pagination.limit);
    intervalRef.current = setInterval(() => {
      // Use current pagination values from state
      setPagination(prev => {
        fetchData(true, prev.page, prev.limit);
        return prev;
      });
    }, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const playSuccessSound = () => {
    try {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate([10, 30, 10, 30]);
      }
      const audio = new Audio('/sounds/success.mp3');
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch {}
  };

  const updateStatus = useCallback(async (orderId: string, newStatus: string, employeeName: string) => {
    const currentOrder = orders.find(o => o.id === orderId);

    if (newStatus === 'PENDING' && currentOrder?.status !== 'PENDING') {
      if (!confirm('Revert this order? Stock will be restored.')) return;
    }

    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, packedBy: employeeName || currentOrder?.packedBy }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'Failed to update order');
        return;
      }

      if (newStatus === 'FINISHED') {
        playSuccessSound();
        addToast('success', `Order ${currentOrder?.channelOrderId} completed!`);
      } else if (newStatus === 'PACKING') {
        addToast('info', `Started packing ${currentOrder?.channelOrderId}`);
      }

      await fetchData(true, pagination.page, pagination.limit);
    } catch {
      addToast('error', 'Network error — could not update order');
    }
  }, [orders, fetchData, addToast, pagination.page, pagination.limit]);

  const batchUpdateStatus = useCallback(async (
    orderIds: string[],
    newStatus: string,
    employeeName: string
  ): Promise<{ successCount: number; errorCount: number }> => {
    try {
      const res = await fetch(`${API_URL}/api/orders/batch/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, status: newStatus, packedBy: employeeName }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'Batch update failed');
        return { successCount: 0, errorCount: orderIds.length };
      }

      const data = await res.json();
      const successCount: number = data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
      const errorCount: number = data.errors?.length ?? 0;

      if (errorCount > 0) {
        addToast('error', `${errorCount} order(s) failed to update`);
      }
      if (successCount > 0) {
        if (newStatus === 'FINISHED') playSuccessSound();
        addToast('success', `${successCount} order(s) moved to ${newStatus}`);
      }

      await fetchData(true, pagination.page, pagination.limit);
      return { successCount, errorCount };
    } catch {
      addToast('error', 'Network error — batch update failed');
      return { successCount: 0, errorCount: orderIds.length };
    }
  }, [fetchData, addToast, pagination.page, pagination.limit]);

  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
    fetchData(false, page, pagination.limit);
  }, [fetchData, pagination.limit]);

  const syncShop = useCallback(async (shopId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/integrations/sync/${shopId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'Sync failed');
        return;
      }

      const data = await res.json();
      addToast('success', `Synced ${data.synced} new orders!`);
      await fetchData(true, pagination.page, pagination.limit);
    } catch {
      addToast('error', 'Network error — sync failed');
    }
  }, [addToast, fetchData, pagination.page, pagination.limit]);

  return { 
    orders, 
    products, 
    loading, 
    toasts, 
    pagination,
    setPage,
    syncShop,
    dismissToast, 
    updateStatus, 
    batchUpdateStatus, 
    refresh: () => fetchData(true, pagination.page, pagination.limit) 
  };
}

