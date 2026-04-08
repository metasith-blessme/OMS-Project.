'use client';

import { useRef, useState } from 'react';
import { ImportResult } from '@/types';

interface ImportModalProps {
  onClose: () => void;
  onImport: (file: File) => Promise<ImportResult | null>;
  type?: 'csv' | 'pdf';
}

export default function ImportModal({ onClose, onImport, type = 'csv' }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptExt = type === 'pdf' ? '.pdf' : '.csv';
  const labelText = type === 'pdf' ? 'Import Packing List PDF' : 'Import Packing List CSV';
  const dropHint = type === 'pdf' ? 'Drop PDF here or tap to browse' : 'Drop CSV here or tap to browse';
  const subHint = type === 'pdf'
    ? 'Combined shipping label + packing list PDF from Shopee Seller Center'
    : 'Export from Shopee Seller Center → Orders → Print Shipping Label';
  const headerColor = type === 'pdf' ? 'bg-blue-600' : 'bg-orange-500';
  const subTextColor = type === 'pdf' ? 'text-blue-100' : 'text-orange-100';
  const dragBorder = type === 'pdf'
    ? (dragging ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300')
    : (dragging ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300');
  const submitBtnColor = type === 'pdf'
    ? 'bg-blue-600 shadow-blue-600/20'
    : 'bg-orange-500 shadow-orange-500/20';

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(acceptExt)) return;
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const res = await onImport(file);
    setLoading(false);
    if (res) setResult(res);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />

      <div className="relative bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`${headerColor} px-6 py-5`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📥</span>
            <div>
              <p className={`${subTextColor} text-[10px] font-black uppercase tracking-widest`}>Shopee Seller Center</p>
              <p className="text-white text-lg font-[900] leading-tight">{labelText}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!result ? (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all cursor-pointer ${dragBorder}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <svg className="text-gray-300 dark:text-gray-600" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-[11px] text-gray-400">{formatSize(file.size)}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{dropHint}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{subHint}</p>
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={acceptExt}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </>
          ) : (
            /* Result */
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-[900] text-green-700 dark:text-green-400">{result.created}</p>
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-wider">Imported</p>
                </div>
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-[900] text-yellow-700 dark:text-yellow-400">{result.skipped}</p>
                  <p className="text-[10px] font-black text-yellow-600 uppercase tracking-wider">Skipped</p>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-[900] text-red-700 dark:text-red-400">{result.errors.reduce((s, e) => s + e.count, 0)}</p>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-wider">Errors</p>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    className="text-[11px] font-bold text-red-500 underline"
                  >
                    {showErrors ? 'Hide errors' : `Show ${result.errors.length} error type(s)`}
                  </button>
                  {showErrors && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {result.errors.map((e, i) => (
                        <div key={i} className="text-[11px] bg-red-50 dark:bg-red-900/10 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-red-600 dark:text-red-400 truncate">{e.reason}</span>
                            <span className="font-black text-red-700 dark:text-red-300 shrink-0">×{e.count}</span>
                          </div>
                          {e.sampleOrderIds.length > 0 && (
                            <div className="text-[10px] text-red-400 mt-0.5 truncate">
                              {e.sampleOrderIds.join(', ')}{e.count > e.sampleOrderIds.length ? '…' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-black text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {result ? 'DONE' : 'CANCEL'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`flex-[2] h-14 rounded-2xl ${submitBtnColor} text-white font-black text-sm shadow-lg active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  UPLOADING...
                </>
              ) : 'UPLOAD'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
