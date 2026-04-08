'use client';

import { useRef } from 'react';
import { Order } from '@/types';

interface OrderCardProps {
  order: Order;
  onStatusUpdate: (orderId: string, newStatus: string) => void;
  // Select mode props
  selectable?: boolean;
  selected?: boolean;
  onLongPress?: (orderId: string) => void;
  onSelect?: (orderId: string) => void;
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'ONE_ITEM':   return { text: '1 Item',   class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    case 'TWO_ITEMS':  return { text: '2 Items',  class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'THREE_PLUS': return { text: '3+ Items', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
    case 'MIXED':      return { text: 'Mixed',    class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    default:           return { text: category,   class: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
  }
}

function isShipToday(shipByDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shipDate = new Date(shipByDate);
  shipDate.setHours(0, 0, 0, 0);
  return shipDate.getTime() <= today.getTime();
}

export default function OrderCard({
  order,
  onStatusUpdate,
  selectable = false,
  selected = false,
  onLongPress,
  onSelect,
}: OrderCardProps) {
  const label = getCategoryLabel(order.category);
  const shipToday = isShipToday(order.shipByDate);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    if (!onLongPress) return;
    pressTimer.current = setTimeout(() => {
      onLongPress(order.id);
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect(order.id);
    }
  };

  // Border color: selected > urgent > default
  const borderClass = selected
    ? 'border-green-500 dark:border-green-500 shadow-green-500/10'
    : shipToday && order.status !== 'FINISHED'
      ? 'border-red-200 dark:border-red-900/40 shadow-red-500/5'
      : 'border-gray-100 dark:border-gray-800';

  return (
    <div
      className={`bg-white dark:bg-gray-900 border-2 rounded-[2rem] shadow-sm flex flex-col transition-all relative
        ${borderClass}
        ${selectable ? 'cursor-pointer active:scale-[0.98]' : 'active:scale-[0.98]'}
        ${selected ? 'ring-2 ring-green-400/30' : ''}
      `}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onClick={handleCardClick}
    >
      {/* Selected checkmark overlay */}
      {selected && (
        <div className="absolute top-3 right-3 z-10 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className={`p-5 flex justify-between items-start border-b border-gray-100 dark:border-gray-800 ${shipToday && order.status !== 'FINISHED' ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
              order.channel === 'SHOPEE' ? 'bg-orange-100 text-orange-700' :
              order.channel === 'TIKTOK' ? 'bg-gray-900 text-white' :
              'bg-green-100 text-green-700'
            }`}>
              {order.channel}
            </span>
            {order.channel === 'LINE' && order.slipReceived && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                SLIP ✓
              </span>
            )}
            {order.channel === 'LINE' && !order.slipReceived && order.status === 'PENDING' && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse">
                AWAITING SLIP
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight">{order.channelOrderId}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${selected ? 'opacity-0' : ''} ${label.class}`}>{label.text}</div>
          {!selectable && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusUpdate(order.id, 'CANCELLED'); }}
              aria-label="Delete order"
              className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 flex items-center justify-center transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Items — always visible */}
      <div className="p-5 flex-1 space-y-4">
        {order.orderItems.map((item) => (
          <div key={item.id} className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center text-lg font-black">
              {item.quantity}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">{item.productVariant.name}</p>
              <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">{item.productVariant.sku}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status Bar (PACKING / FINISHED) */}
      {(order.status === 'PACKING' || order.status === 'FINISHED') && (
        <div className={`mx-5 p-3 rounded-2xl mb-2 flex items-center gap-3 ${order.status === 'FINISHED' ? 'bg-green-50 dark:bg-green-900/10' : 'bg-orange-50 dark:bg-orange-900/10'}`}>
          <div className={`w-2 h-2 rounded-full ${order.status === 'FINISHED' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></div>
          <p className={`text-[10px] font-black uppercase tracking-wide ${order.status === 'FINISHED' ? 'text-green-700' : 'text-orange-700'}`}>
            {order.status === 'FINISHED' ? 'PACKED BY' : 'PACKING'}: {order.packedBy}
          </p>
        </div>
      )}

      {/* Actions — hidden in select mode */}
      {!selectable && (
        <div className="p-5 mt-auto" onClick={e => e.stopPropagation()}>
          {order.status === 'PENDING' && (
            <button
              onClick={() => onStatusUpdate(order.id, 'PACKING')}
              className="w-full h-14 bg-indigo-600 text-white rounded-[1.25rem] text-sm font-black shadow-lg shadow-indigo-500/20 active:bg-indigo-700 transition-all"
            >
              START PACKING
            </button>
          )}
          {order.status === 'PACKING' && (
            <div className="flex gap-3">
              <button
                onClick={() => onStatusUpdate(order.id, 'PENDING')}
                className="h-14 px-4 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl active:scale-95 transition-all"
              >
                ↩️
              </button>
              <button
                onClick={() => onStatusUpdate(order.id, 'FINISHED')}
                className="flex-1 h-14 bg-green-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-green-600/20"
              >
                FINISH
              </button>
            </div>
          )}
          {order.status === 'FINISHED' && (
            <div className="flex items-center justify-between px-2 h-10">
              <span className="text-green-600 font-black text-[10px] tracking-widest uppercase">✓ COMPLETED</span>
              <button
                onClick={() => onStatusUpdate(order.id, 'PACKING')}
                className="text-[10px] font-bold text-gray-400 underline"
              >
                REOPEN
              </button>
            </div>
          )}
        </div>
      )}

      {/* In select mode: tap hint */}
      {selectable && (
        <div className="p-5 mt-auto">
          <div className={`h-10 flex items-center justify-center rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all ${
            selected
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-400'
          }`}>
            {selected ? '✓ SELECTED' : 'TAP TO SELECT'}
          </div>
        </div>
      )}
    </div>
  );
}

export { isShipToday };
