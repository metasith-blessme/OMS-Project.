import { PDFParse } from 'pdf-parse';

export interface ParsedShopeePDFItem {
  rawName: string;       // full product name as it appeared in the PDF (joined across wrapped lines)
  quantity: number;
}

export interface ParsedShopeePDFOrder {
  orderId: string;
  shipByDate: Date | null;
  items: ParsedShopeePDFItem[];
}

// Regex constants
const ORDER_NO_RE = /Shopee Order No\.\s*([A-Z0-9]+)/;
const DATE_RE = /(\d{2})-(\d{2})-(\d{4})/;
// Item rows always start with "<row#> [..." since Shopee names begin with brackets like [พร้อมส่ง]
const ITEM_START_RE = /^\s*(\d+)\s+\[/;
// The footer row that closes the items table: "<total>\t<orderId>\tShopee Order No."
const ITEMS_FOOTER_RE = /\d+\s+[A-Z0-9]+\s+Shopee Order No\./;
const TRAILING_QTY_RE = /(\d+)\s*$/;           // last integer on a line = qty

/**
 * Splits the full PDF text into one chunk per page.
 * The library inserts `-- N of M --` between pages.
 */
function splitPages(text: string): string[] {
  return text.split(/--\s*\d+\s+of\s+\d+\s*--/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parses one item table chunk into individual items.
 * Each item begins with a line like "1 <name start>" and continues across wrapped lines
 * until the next item-start line or end of section. The quantity is the trailing integer
 * on the LAST line of the item.
 */
function parseItems(itemSectionLines: string[]): ParsedShopeePDFItem[] {
  // Group consecutive lines into items based on item-start markers
  const groups: string[][] = [];
  let current: string[] | null = null;

  for (const line of itemSectionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (ITEM_START_RE.test(trimmed)) {
      if (current) groups.push(current);
      current = [trimmed];
    } else if (current) {
      current.push(trimmed);
    }
  }
  if (current) groups.push(current);

  const items: ParsedShopeePDFItem[] = [];
  for (const group of groups) {
    // Strip the leading row number from the first line
    const firstLine = group[0].replace(/^\d+\s+/, '');
    const restLines = group.slice(1);

    // Quantity is the trailing integer on the LAST line of the item
    const lastLine = restLines.length > 0 ? restLines[restLines.length - 1] : firstLine;
    const qtyMatch = lastLine.match(TRAILING_QTY_RE);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

    // Build the full name by joining all lines, then strip the trailing qty digit
    let nameParts: string[];
    if (restLines.length > 0) {
      const lastWithoutQty = qtyMatch ? lastLine.slice(0, qtyMatch.index).trim() : lastLine;
      nameParts = [firstLine, ...restLines.slice(0, -1), lastWithoutQty];
    } else {
      // Edge case: single-line item — strip trailing qty from the only line
      const firstWithoutQty = qtyMatch ? firstLine.slice(0, qtyMatch.index).trim() : firstLine;
      nameParts = [firstWithoutQty];
    }
    const rawName = nameParts.join(' ').replace(/\s+/g, ' ').trim();

    if (rawName && quantity > 0) {
      items.push({ rawName, quantity });
    }
  }

  return items;
}

/**
 * Parses a single page chunk into a ParsedShopeePDFOrder.
 * Returns null if the page does not contain an order (e.g., a cover page).
 */
function parsePage(pageText: string): ParsedShopeePDFOrder | null {
  const orderMatch = pageText.match(ORDER_NO_RE);
  if (!orderMatch) return null;
  const orderId = orderMatch[1];

  const dateMatch = pageText.match(DATE_RE);
  let shipByDate: Date | null = null;
  if (dateMatch) {
    const [, dd, mm, yyyy] = dateMatch;
    // Construct as Asia/Bangkok midnight — close enough since shipByDate is a date, not a moment
    shipByDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00+07:00`);
  }

  // Locate the items section by walking the lines: an item starts with "<row#> [..." and the
  // section ends at the footer line "<total>\t<orderId>\tShopee Order No.".
  const lines = pageText.split('\n');
  const footerIdx = lines.findIndex(l => ITEMS_FOOTER_RE.test(l));
  const upperBound = footerIdx === -1 ? lines.length : footerIdx;
  let firstItemIdx = -1;
  for (let i = 0; i < upperBound; i++) {
    if (ITEM_START_RE.test(lines[i])) { firstItemIdx = i; break; }
  }
  if (firstItemIdx === -1) return { orderId, shipByDate, items: [] };

  const itemSectionLines = lines.slice(firstItemIdx, upperBound);
  const items = parseItems(itemSectionLines);

  return { orderId, shipByDate, items };
}

export class ShopeePDFParser {
  static async parse(buffer: Buffer): Promise<ParsedShopeePDFOrder[]> {
    const result = await new PDFParse({ data: buffer }).getText();
    const text: string = result.text || '';
    const pages = splitPages(text);
    const orders: ParsedShopeePDFOrder[] = [];
    for (const page of pages) {
      const parsed = parsePage(page);
      if (parsed) orders.push(parsed);
    }
    return orders;
  }
}

/**
 * Matches a raw product name (from the PDF) to a ProductVariant by keyword scoring.
 *
 * Strategy:
 *  1. Find variants whose flavor keywords appear in the name. The flavor with the most
 *     keyword hits wins (ties → no match, surface as error).
 *  2. Among variants of that flavor, pick by pack size: if the name contains a
 *     "<n> ถุง" / "<n>-pack" signal that matches a variant's packSize, use it.
 *     Otherwise default to the smallest pack size (1).
 *
 * Returns null if no flavor can be confidently identified.
 */
export interface KeywordVariant {
  id: string;
  productId: string;
  packSize: number;
  keywords: string[];
}

const PACK_RE = /(\d+)\s*ถุง|(\d+)\s*pack/i;

/**
 * Strips Private Use Area codepoints (U+E000–U+F8FF) that some Thai fonts insert as
 * glyph-positioning markers between letters. The PDF text from Shopee packing lists
 * contains these and they break naive substring matching.
 */
function normalizeThai(s: string): string {
  return s.replace(/[\uE000-\uF8FF]/g, '');
}

export function matchVariantByKeywords(
  rawName: string,
  variants: KeywordVariant[]
): { variantId: string; reason?: string } | { variantId: null; reason: string } {
  const lower = normalizeThai(rawName).toLowerCase();

  // 1. Score each variant by keyword hits, then group by productId (flavor) to find best flavor.
  const flavorScores = new Map<string, number>();
  for (const v of variants) {
    let score = 0;
    for (const kw of v.keywords) {
      if (kw && lower.includes(kw.toLowerCase())) score++;
    }
    if (score > 0) {
      flavorScores.set(v.productId, Math.max(flavorScores.get(v.productId) ?? 0, score));
    }
  }

  if (flavorScores.size === 0) {
    return { variantId: null, reason: `No flavor keyword matched: "${rawName}"` };
  }

  // Pick the best-scoring flavor; tie → ambiguous
  const sorted = [...flavorScores.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return { variantId: null, reason: `Ambiguous flavor match: "${rawName}"` };
  }
  const bestFlavorId = sorted[0][0];
  const flavorVariants = variants.filter(v => v.productId === bestFlavorId);

  // 2. Detect pack size from the name
  const packMatch = rawName.match(PACK_RE);
  const detectedPackSize = packMatch ? parseInt(packMatch[1] || packMatch[2], 10) : 1;

  // Find exact pack-size match, falling back to closest available
  const exact = flavorVariants.find(v => v.packSize === detectedPackSize);
  if (exact) return { variantId: exact.id };

  // No exact pack size — use the smallest pack size of this flavor
  const fallback = flavorVariants.sort((a, b) => a.packSize - b.packSize)[0];
  return {
    variantId: fallback.id,
    reason: `Pack size ${detectedPackSize} not found for flavor; using ${fallback.packSize}-pack`,
  };
}
