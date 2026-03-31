'use client';

import { Order } from '@/types';

interface FilterBarProps {
  orders: Order[];
  statusFilter: 'PENDING' | 'PACKING' | 'FINISHED';
  setStatusFilter: (s: 'PENDING' | 'PACKING' | 'FINISHED') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  urgencyFilter: 'ALL' | 'TODAY' | 'TOMORROW';
  setUrgencyFilter: (u: 'ALL' | 'TODAY' | 'TOMORROW') => void;
  onSync: () => void;
}

export default function FilterBar({
  orders,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  urgencyFilter,
  setUrgencyFilter,
  onSync,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-5 mb-8">
      <div className="flex bg-gray-200/50 dark:bg-gray-800/50 p-1.5 rounded-2xl shadow-inner border border-white/50 dark:border-gray-800">
        {(['PENDING', 'PACKING', 'FINISHED'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-[900] transition-all tracking-tight ${
              statusFilter === status
                ? status === 'PACKING'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : status === 'FINISHED'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {status === 'PENDING' ? 'TO PACK' : status === 'FINISHED' ? 'DONE' : status} ({orders.filter(o => o.status === status).length})
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ORDER ID / SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none transition-all dark:text-white"
          />
          <span className="absolute left-3.5 top-3.5 opacity-40">🔍</span>
        </div>
        <button
          onClick={() => setUrgencyFilter(urgencyFilter === 'TODAY' ? 'ALL' : 'TODAY')}
          className={`h-12 px-4 rounded-2xl border-2 flex items-center justify-center transition-all ${
            urgencyFilter === 'TODAY'
              ? 'bg-red-500 border-red-500 text-white animate-pulse'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-red-500'
          }`}
        >
          <span className="text-xl">🔥</span>
        </button>

        {statusFilter === 'PENDING' && (
          <button
            onClick={onSync}
            className="h-12 px-5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">SYNC SHOPEE</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
