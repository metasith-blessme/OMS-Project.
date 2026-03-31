'use client';

import { Toast } from '@/types';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const TOAST_STYLES = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-indigo-600 text-white',
};

const TOAST_ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          className={`${TOAST_STYLES[toast.type]} px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold animate-[slideUp_0.2s_ease-out] cursor-pointer`}
        >
          <span className="text-lg">{TOAST_ICONS[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
