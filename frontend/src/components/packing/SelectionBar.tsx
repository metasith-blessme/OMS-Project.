'use client';

interface SelectionBarProps {
  count: number;
  onCancel: () => void;
  onPack: () => void;
}

export default function SelectionBar({ count, onCancel, onPack }: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[150] pb-safe">
      <div className="bg-white dark:bg-gray-900 border-t-2 border-gray-100 dark:border-gray-800 px-4 py-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Selected</p>
            <p className="text-xl font-[900] text-gray-900 dark:text-white leading-tight">{count} order{count !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onCancel}
            className="h-12 px-5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black text-sm active:scale-95 transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={onPack}
            className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            PACK {count}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
