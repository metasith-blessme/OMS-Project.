'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, Product, Toast, CreateOrderPayload, ImportResult } from '@/types';
import { apiFetch } from '@/lib/api';

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
        apiFetch(`/api/orders?page=${page}&limit=${limit}`),
        apiFetch(`/api/products`)
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
    if (newStatus === 'CANCELLED') {
      const restoreNote = currentOrder?.status === 'PENDING'
        ? ''
        : ' Stock will be restored.';
      if (!confirm(`Delete order ${currentOrder?.channelOrderId}?${restoreNote}`)) return;
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
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
      } else if (newStatus === 'CANCELLED') {
        addToast('info', `Order ${currentOrder?.channelOrderId} deleted`);
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
      const res = await apiFetch(`/api/orders/batch/status`, {
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

  const importShopeeCSV = useCallback(async (file: File): Promise<ImportResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch(`/api/integrations/shopee/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'CSV upload failed');
        return null;
      }
      const data: ImportResult = await res.json();
      await fetchData(true, pagination.page, pagination.limit);
      return data;
    } catch {
      addToast('error', 'Network error — CSV upload failed');
      return null;
    }
  }, [addToast, fetchData, pagination.page, pagination.limit]);

  const importShopeePDF = useCallback(async (file: File): Promise<ImportResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch(`/api/integrations/shopee/upload-pdf`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'PDF upload failed');
        return null;
      }
      const data: ImportResult = await res.json();
      await fetchData(true, pagination.page, pagination.limit);
      return data;
    } catch {
      addToast('error', 'Network error — PDF upload failed');
      return null;
    }
  }, [addToast, fetchData, pagination.page, pagination.limit]);

  const updateStock = useCallback(async (productId: string, baseStock: number): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseStock }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'Failed to update stock');
        return false;
      }
      addToast('success', 'Stock updated');
      await fetchData(true, pagination.page, pagination.limit);
      return true;
    } catch {
      addToast('error', 'Network error — could not update stock');
      return false;
    }
  }, [addToast, fetchData, pagination.page, pagination.limit]);

  const createOrder = useCallback(async (data: CreateOrderPayload): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        addToast('error', errorData.error || 'Failed to create order');
        return false;
      }
      addToast('success', `Order ${data.channelOrderId} created`);
      await fetchData(true, pagination.page, pagination.limit);
      return true;
    } catch {
      addToast('error', 'Network error — could not create order');
      return false;
    }
  }, [addToast, fetchData, pagination.page, pagination.limit]);

  return {
    orders,
    products,
    loading,
    toasts,
    pagination,
    setPage,
    importShopeeCSV,
    importShopeePDF,
    createOrder,
    updateStock,
    dismissToast,
    updateStatus,
    batchUpdateStatus,
    refresh: () => fetchData(true, pagination.page, pagination.limit)
  };
}

