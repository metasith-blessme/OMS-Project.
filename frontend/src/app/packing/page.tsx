'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { Order } from '@/types';
import LoginScreen from '@/components/packing/LoginScreen';
import StockTicker from '@/components/packing/StockTicker';
import FilterBar from '@/components/packing/FilterBar';
import OrderCard, { isShipToday } from '@/components/packing/OrderCard';
import ToastContainer from '@/components/packing/ToastContainer';
import SelectionBar from '@/components/packing/SelectionBar';
import PackingSummaryModal from '@/components/packing/PackingSummaryModal';

// Category display order and labels
const CATEGORY_SECTIONS: { key: string; label: string }[] = [
  { key: 'ONE_ITEM',   label: '1 ITEM' },
  { key: 'TWO_ITEMS',  label: '2 ITEMS' },
  { key: 'THREE_PLUS', label: '3+ ITEMS' },
  { key: 'MIXED',      label: 'MIXED' },
];

export default function PackingDashboard() {
  const { employeeName, isLoggedIn, login, logout } = useAuth();
  const { 
    orders, 
    products, 
    toasts, 
    pagination,
    setPage,
    syncShop,
    dismissToast, 
    updateStatus, 
    batchUpdateStatus 
  } = useOrders();

  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'PACKING' | 'FINISHED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW'>('ALL');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newMode;
    });
  }, []);

  const handleStatusUpdate = useCallback((orderId: string, newStatus: string) => {
    updateStatus(orderId, newStatus, employeeName);
  }, [updateStatus, employeeName]);

  // Select mode handlers
  const handleEnterSelectMode = useCallback((orderId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([orderId]));
  }, []);

  const handleToggleSelect = useCallback((orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowSummaryModal(false);
  }, []);

  const handleConfirmBatch = useCallback(async () => {
    setBatchLoading(true);
    await batchUpdateStatus(Array.from(selectedIds), 'PACKING', employeeName);
    setBatchLoading(false);
    setShowSummaryModal(false);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [selectedIds, employeeName, batchUpdateStatus]);

  // All hooks must be above any early return
  const filteredOrders = useMemo(() => orders.filter(order => {
    const statusMatch = order.status === statusFilter;
    const searchMatch = searchQuery === '' ||
      order.channelOrderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderItems.some(item => item.productVariant.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const shipToday = isShipToday(order.shipByDate);
    const urgencyMatch =
      urgencyFilter === 'ALL' ||
      (urgencyFilter === 'TODAY' && shipToday) ||
      (urgencyFilter === 'TOMORROW' && !shipToday);
    return statusMatch && searchMatch && urgencyMatch;
  }), [orders, statusFilter, searchQuery, urgencyFilter]);

  // Group by category for all tabs
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, Order[]>();
    for (const section of CATEGORY_SECTIONS) {
      const items = filteredOrders.filter(o => o.category === section.key);
      if (items.length > 0) groups.set(section.key, items);
    }
    return groups;
  }, [filteredOrders]);

  const selectedOrders = useMemo(
    () => orders.filter(o => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  if (!isLoggedIn) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-[100svh] bg-[#f8f9fc] dark:bg-gray-950 transition-colors duration-200">
      {/* Header */}
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-[100] safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 rounded-xl p-1.5 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <span className="text-lg font-[900] text-gray-900 dark:text-white tracking-tighter">OMS</span>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1 hidden sm:block" />
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 hidden sm:block uppercase tracking-widest">{employeeName}</p>
          </div>

          <div className="flex items-center gap-2">
            {selectMode && (
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider animate-pulse">
                SELECT MODE
              </span>
            )}
            <button onClick={toggleDarkMode} className="p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:scale-90 transition-all">
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={logout} className="sm:hidden p-2.5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 active:scale-90 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            <button onClick={logout} className="hidden sm:block text-xs font-black text-gray-400 hover:text-red-500 transition-colors uppercase ml-2">LOGOUT</button>
          </div>
        </div>
      </nav>

      <StockTicker products={products} />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 pb-40">
        <FilterBar
          orders={orders}
          statusFilter={statusFilter}
          setStatusFilter={(s) => {
            setStatusFilter(s);
            handleCancelSelect();
            setPage(1);
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          urgencyFilter={urgencyFilter}
          setUrgencyFilter={setUrgencyFilter}
          onSync={() => syncShop('123456')}
        />

        {/* Long-press hint (TO PACK only, not in select mode) */}
        {statusFilter === 'PENDING' && !selectMode && filteredOrders.length > 1 && (
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 text-center mb-5 uppercase tracking-widest">
            Hold any card to select multiple orders
          </p>
        )}

        {/* Grouped sections — all tabs */}
        <div className="space-y-8">
          {CATEGORY_SECTIONS.map(section => {
            const sectionOrders = groupedOrders.get(section.key);
            if (!sectionOrders) return null;
            return (
              <div key={section.key}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">
                    {section.label}
                  </span>
                  <span className="text-[10px] font-black text-gray-300 dark:text-gray-700">({sectionOrders.length})</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sectionOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusUpdate={handleStatusUpdate}
                      selectable={selectMode && statusFilter === 'PENDING'}
                      selected={selectedIds.has(order.id)}
                      onLongPress={statusFilter === 'PENDING' ? handleEnterSelectMode : undefined}
                      onSelect={statusFilter === 'PENDING' ? handleToggleSelect : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 dark:text-gray-600 font-bold text-sm">No orders found</p>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-12">
            <button
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-30 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 shadow-sm"
            >
              PREV
            </button>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              PAGE {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-30 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 shadow-sm"
            >
              NEXT
            </button>
          </div>
        )}
      </main>

      {/* Selection bar (appears when orders selected) */}
      <SelectionBar
        count={selectedIds.size}
        onCancel={handleCancelSelect}
        onPack={() => setShowSummaryModal(true)}
      />

      {/* Packing summary modal */}
      {showSummaryModal && (
        <PackingSummaryModal
          selectedOrders={selectedOrders}
          onConfirm={handleConfirmBatch}
          onCancel={() => setShowSummaryModal(false)}
          loading={batchLoading}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="h-safe-bottom" />
    </div>
  );
}
