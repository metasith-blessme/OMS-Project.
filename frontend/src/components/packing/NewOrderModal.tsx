'use client';

import { useState } from 'react';
import { Product, CreateOrderPayload } from '@/types';

interface NewOrderModalProps {
  products: Product[];
  onClose: () => void;
  onCreate: (data: CreateOrderPayload) => Promise<boolean>;
}

interface ItemRow {
  productVariantId: string;
  quantity: number;
  price: number;
}

interface FlatVariant {
  id: string;
  sku: string;
  name: string;
  productName: string;
}

export default function NewOrderModal({ products, onClose, onCreate }: NewOrderModalProps) {
  const [channel, setChannel] = useState<'LINE' | 'TIKTOK'>('LINE');
  const [channelOrderId, setChannelOrderId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ productVariantId: '', quantity: 1, price: 0 }]);
  const [loading, setLoading] = useState(false);

  // Flatten products → variants for the dropdown
  const variants: FlatVariant[] = products.flatMap(p =>
    (p as any).variants?.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      productName: p.name,
    })) ?? []
  );

  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const canSubmit = channelOrderId.trim() && items.every(i => i.productVariantId && i.quantity > 0);

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const addItem = () => setItems(prev => [...prev, { productVariantId: '', quantity: 1, price: 0 }]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const success = await onCreate({
      channel,
      channelOrderId: channelOrderId.trim(),
      status: 'PENDING',
      total,
      items,
    });
    setLoading(false);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />

      <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-green-600 px-6 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">➕</span>
            <div>
              <p className="text-green-100 text-[10px] font-black uppercase tracking-widest">Manual Entry</p>
              <p className="text-white text-lg font-[900] leading-tight">New Order</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Channel toggle */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Channel</p>
            <div className="flex gap-2">
              {(['LINE', 'TIKTOK'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`flex-1 h-11 rounded-2xl text-sm font-black transition-all ${
                    channel === ch
                      ? ch === 'LINE'
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                        : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Order reference */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Order Ref / Customer Name</p>
            <input
              type="text"
              placeholder={channel === 'LINE' ? 'e.g. นิค LINE 0401' : 'e.g. TIKTOK-001'}
              value={channelOrderId}
              onChange={e => setChannelOrderId(e.target.value)}
              className="w-full h-12 px-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold focus:border-green-500 outline-none transition-all dark:text-white"
            />
          </div>

          {/* Items */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Items</p>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Item {index + 1}</span>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-400 text-sm font-black"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <select
                    value={item.productVariantId}
                    onChange={e => updateItem(index, { productVariantId: e.target.value })}
                    className="w-full h-10 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold focus:border-green-500 outline-none dark:text-white"
                  >
                    <option value="">Select product...</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.productName} — {v.name} ({v.sku})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Qty</p>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full h-9 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold focus:border-green-500 outline-none dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Price (฿)</p>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.price}
                        onChange={e => updateItem(index, { price: parseFloat(e.target.value) || 0 })}
                        className="w-full h-9 px-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold focus:border-green-500 outline-none dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-3 w-full h-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-black text-gray-400 hover:border-green-400 hover:text-green-500 transition-all"
            >
              + Add Item
            </button>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span>
            <span className="text-lg font-[900] text-gray-900 dark:text-white">฿{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-3 flex gap-3 flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="flex-[2] h-14 rounded-2xl bg-green-600 text-white font-black text-sm shadow-lg shadow-green-600/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                CREATING...
              </>
            ) : 'CREATE ORDER'}
          </button>
        </div>
      </div>
    </div>
  );
}
