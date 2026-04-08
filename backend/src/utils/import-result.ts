/**
 * Groups raw per-row import errors by their `reason` string so the response
 * doesn't repeat the same message dozens of times. Up to 5 sample order IDs
 * are kept per group for context.
 */
export interface RawImportError {
  orderId: string;
  reason: string;
}

export interface GroupedImportError {
  reason: string;
  count: number;
  sampleOrderIds: string[];
}

export function dedupeErrors(errors: RawImportError[]): GroupedImportError[] {
  const map = new Map<string, GroupedImportError>();
  for (const e of errors) {
    const existing = map.get(e.reason);
    if (existing) {
      existing.count++;
      if (existing.sampleOrderIds.length < 5) existing.sampleOrderIds.push(e.orderId);
    } else {
      map.set(e.reason, { reason: e.reason, count: 1, sampleOrderIds: [e.orderId] });
    }
  }
  // Most-common first
  return [...map.values()].sort((a, b) => b.count - a.count);
}
