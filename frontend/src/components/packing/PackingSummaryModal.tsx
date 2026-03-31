'use client';

import { useMemo } from 'react';
import { Order } from '@/types';

interface PackingSummaryModalProps {
  selectedOrders: Order[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

interface SummaryItem {
  variantId: string;
  name: string;
  sku: string;
  totalQty: number;
}

function computeSummary(orders: Order[]): SummaryItem[] {
  const map = new Map<string, SummaryItem>();
  for (const order of orders) {
    for (const item of order.orderItems) {
      const id = item.productVariant.id;
      const existing = map.get(id);
      if (existing) {
        existing.totalQty += item.quantity;
      } else {
        map.set(id, {
          variantId: id,
          name: item.productVariant.name,
          sku: item.productVariant.sku,
          totalQty: item.quantity,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

export default function PackingSummaryModal({
  selectedOrders,
  onConfirm,
  onCancel,
  loading,
}: PackingSummaryModalProps) {
  const summary = useMemo(() => computeSummary(selectedOrders), [selectedOrders]);
  const totalItems = summary.reduce((sum, s) => sum + s.totalQty, 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">Packing Summary</p>
              <p className="text-white text-lg font-[900] leading-tight">
                {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} · {totalItems} items total
              </p>
            </div>
          </div>
        </div>

        {/* Item list */}
        <div className="px-6 py-4 space-y-3 max-h-64 overflow-y-auto">
          {summary.map(item => (
            <div key={item.variantId} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-[900] text-indigo-700 dark:text-indigo-400">×{item.totalQty}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.sku}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-6" />

        {/* Actions */}
        <div className="px-6 py-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-[2] h-14 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                STARTING...
              </>
            ) : (
              'START ALL 🚀'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
