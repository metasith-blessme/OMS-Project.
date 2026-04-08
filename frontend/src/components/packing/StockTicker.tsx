'use client';

import { useState } from 'react';
import { Product } from '@/types';

interface StockTickerProps {
  products: Product[];
  onUpdateStock: (productId: string, baseStock: number) => Promise<boolean>;
}

export default function StockTicker({ products, onUpdateStock }: StockTickerProps) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const open = (p: Product) => {
    setEditing(p);
    setValue(String(p.baseStock));
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
  };

  const save = async () => {
    if (!editing) return;
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    const ok = await onUpdateStock(editing.id, n);
    setSaving(false);
    if (ok) setEditing(null);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center gap-4 px-4 py-2.5 min-w-max">
          <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg">STOCK</span>
          {products.map(p => (
            <button
              key={p.id}
              onClick={() => open(p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                p.baseStock < 50
                  ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30 hover:border-red-300'
                  : 'bg-gray-50/50 border-gray-50 dark:bg-gray-800/50 dark:border-gray-800 hover:border-indigo-300'
              }`}
            >
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{p.name}</span>
              <span className={`text-xs font-black ${p.baseStock < 50 ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
                {p.baseStock}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-xs shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-6 py-5">
              <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Adjust Stock</p>
              <p className="text-white text-base font-[900] leading-tight mt-0.5">{editing.name}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current</p>
                <p className="text-2xl font-[900] text-gray-900 dark:text-white">{editing.baseStock}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New value</p>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  autoFocus
                  className="w-full h-14 px-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-2xl font-[900] focus:border-indigo-500 outline-none dark:text-white"
                />
                {(() => {
                  const n = parseInt(value, 10);
                  if (isNaN(n)) return null;
                  const delta = n - editing.baseStock;
                  if (delta === 0) return null;
                  return (
                    <p className={`text-[11px] font-bold mt-1.5 ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </p>
                  );
                })()}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={close}
                disabled={saving}
                className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 font-black text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={save}
                disabled={saving || value === '' || isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0 || parseInt(value, 10) === editing.baseStock}
                className="flex-[2] h-14 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-40"
              >
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
