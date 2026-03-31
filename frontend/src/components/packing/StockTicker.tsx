'use client';

import { Product } from '@/types';

interface StockTickerProps {
  products: Product[];
}

export default function StockTicker({ products }: StockTickerProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="flex items-center gap-4 px-4 py-2.5 min-w-max">
        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg">STOCK</span>
        {products.map(p => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
              p.baseStock < 50
                ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'
                : 'bg-gray-50/50 border-gray-50 dark:bg-gray-800/50 dark:border-gray-800'
            }`}
          >
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{p.name}</span>
            <span className={`text-xs font-black ${p.baseStock < 50 ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
              {p.baseStock}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
