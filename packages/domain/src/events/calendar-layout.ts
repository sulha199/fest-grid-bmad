/**
 * Pure ordering + banded-layout logic for the weekly calendar grid (spec-calendar-unified-banded-grid).
 *
 * Framework-agnostic on purpose: `packages/ui` renders from it, and the sort key is the single
 * source of truth that the backend's day-scoped continuation ordering mirrors.
 */

export interface CalendarSortable {
  id: string;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
}

/** Sentinel so untimed schedules sort after timed ones on the same dates. */
const UNTIMED = '99:99';

/**
 * The one calendar ordering: start date asc, end date asc (earlier finish first), start time asc
 * (untimed last), then id. Identical on desktop, mobile and the backend continuation query.
 */
export function compareCalendarSchedules(a: CalendarSortable, b: CalendarSortable): number {
  const byStart = a.eventStartDate.localeCompare(b.eventStartDate);
  if (byStart !== 0) return byStart;

  const byEnd = (a.eventEndDate || a.eventStartDate).localeCompare(b.eventEndDate || b.eventStartDate);
  if (byEnd !== 0) return byEnd;

  const byTime = (a.eventStartTime || UNTIMED).localeCompare(b.eventStartTime || UNTIMED);
  if (byTime !== 0) return byTime;

  return String(a.id).localeCompare(String(b.id));
}

export interface CalendarLayoutItem {
  /** Stable unique key (a schedule run) — placement is remembered by it. */
  key: string;
  /** 0-based first column the item covers. */
  startCol: number;
  /** Number of columns covered (>= 1). A multi-day bar costs one slot in each. */
  spanCount: number;
}

export interface CalendarPlacement {
  band: number;
  row: number;
}

/**
 * Assigns every item a `{ band, row }`.
 *
 * `items` MUST already be sorted with {@link compareCalendarSchedules}.
 *
 * - Band: `floor(maxColumnRank / bandSize)`, where `maxColumnRank` is the item's deepest 0-based
 *   rank across the columns it covers (counting items that sort before it).
 * - Row: first-fit inside the band, so bands pack compactly. Nothing ever backfills an earlier band.
 * - Append-only: placements in `previous` are kept verbatim. A new item is placed no earlier than
 *   the lowest band any placed item in its columns already occupies, and (inside a band) below the
 *   lowest row already used in each of its columns — so a late-arriving row can never render above
 *   something already on screen, even when it sorts earlier.
 */
export function layoutCalendarBands(
  items: readonly CalendarLayoutItem[],
  bandSize: number,
  columnCount: number,
  previous: ReadonlyMap<string, CalendarPlacement> = new Map()
): Map<string, CalendarPlacement> {
  const size = Math.max(1, Math.floor(bandSize));
  const result = new Map<string, CalendarPlacement>();

  // Frozen state derived from the placements we are keeping.
  const lowestBandByCol: number[] = Array.from({ length: columnCount }, () => 0);
  const floorRow = new Map<number, number[]>(); // band -> per-column next free row (frozen items only)
  const occupied = new Map<number, Set<string>>(); // band -> "row:col"

  const floorsOf = (band: number) => {
    let floors = floorRow.get(band);
    if (!floors) {
      floors = Array.from({ length: columnCount }, () => 0);
      floorRow.set(band, floors);
    }
    return floors;
  };
  const occupiedOf = (band: number) => {
    let cells = occupied.get(band);
    if (!cells) {
      cells = new Set();
      occupied.set(band, cells);
    }
    return cells;
  };
  const occupy = (item: CalendarLayoutItem, band: number, row: number, freeze: boolean) => {
    const cells = occupiedOf(band);
    const floors = floorsOf(band);
    for (let c = item.startCol; c < item.startCol + item.spanCount && c < columnCount; c++) {
      cells.add(`${row}:${c}`);
      if (freeze) floors[c] = Math.max(floors[c], row + 1);
      lowestBandByCol[c] = Math.max(lowestBandByCol[c], band);
    }
  };

  const keep = new Set<string>();
  items.forEach((item) => {
    const placed = previous.get(item.key);
    if (!placed) return;
    // An item whose span changed since it was placed (refetched data) may now collide with a kept
    // neighbour; re-place it instead of drawing two items in one cell.
    const end = Math.min(columnCount, item.startCol + item.spanCount);
    const cells = occupiedOf(placed.band);
    for (let c = item.startCol; c < end; c++) if (cells.has(`${placed.row}:${c}`)) return;
    keep.add(item.key);
    result.set(item.key, placed);
    occupy(item, placed.band, placed.row, true);
  });

  // Rank pass over every item (placed or not) in sorted order.
  const counters: number[] = Array.from({ length: columnCount }, () => 0);
  const naturalBand = new Map<string, number>();
  items.forEach((item) => {
    const end = Math.min(columnCount, item.startCol + item.spanCount);
    let maxRank = 0;
    for (let c = item.startCol; c < end; c++) maxRank = Math.max(maxRank, counters[c]);
    for (let c = item.startCol; c < end; c++) counters[c] += 1;
    naturalBand.set(item.key, Math.floor(maxRank / size));
  });

  items.forEach((item) => {
    if (keep.has(item.key)) return;
    const end = Math.min(columnCount, item.startCol + item.spanCount);
    let band = naturalBand.get(item.key) ?? 0;
    for (let c = item.startCol; c < end; c++) band = Math.max(band, lowestBandByCol[c]);

    const floors = floorsOf(band);
    const cells = occupiedOf(band);
    let row = 0;
    for (let c = item.startCol; c < end; c++) row = Math.max(row, floors[c]);
    for (;;) {
      let free = true;
      for (let c = item.startCol; c < end; c++) {
        if (cells.has(`${row}:${c}`)) {
          free = false;
          break;
        }
      }
      if (free) break;
      row += 1;
    }
    result.set(item.key, { band, row });
    // Not frozen yet: later items of the same batch may still fill gaps next to it (first-fit).
    occupy(item, band, row, false);
  });

  return result;
}

export interface CalendarNavItem {
  key: string;
  band: number;
  row: number;
  startCol: number;
  spanCount: number;
}

export type CalendarNavDirection = 'left' | 'right' | 'up' | 'down';

const readingOrder = (a: CalendarNavItem, b: CalendarNavItem) =>
  a.band - b.band || a.row - b.row || a.startCol - b.startCol;

/**
 * Arrow-key target for the roving tabindex over the banded grid. Left/Right walk reading order
 * (band, row, column); Up/Down move to the nearest item above/below whose columns cover the
 * current item's first column, crossing band boundaries. Returns `null` when there is no target.
 */
export function navigateCalendarGrid(
  items: readonly CalendarNavItem[],
  currentKey: string,
  direction: CalendarNavDirection
): string | null {
  const ordered = [...items].sort(readingOrder);
  const idx = ordered.findIndex((item) => item.key === currentKey);
  if (idx === -1) return null;
  const current = ordered[idx];

  if (direction === 'left') return ordered[idx - 1]?.key ?? null;
  if (direction === 'right') return ordered[idx + 1]?.key ?? null;

  const covers = (item: CalendarNavItem) =>
    current.startCol >= item.startCol && current.startCol < item.startCol + item.spanCount;
  if (direction === 'up') {
    for (let i = idx - 1; i >= 0; i--) if (covers(ordered[i])) return ordered[i].key;
    return null;
  }
  for (let i = idx + 1; i < ordered.length; i++) if (covers(ordered[i])) return ordered[i].key;
  return null;
}
