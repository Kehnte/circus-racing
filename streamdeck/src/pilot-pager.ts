// pilot-pager.ts — Manages which pilot page is currently visible (5 pilots per page).

export const PILOTS_PER_PAGE = 5;

let currentPage = 0;
type PageListener = (page: number) => void;
const listeners: PageListener[] = [];

export function getCurrentPage(): number { return currentPage; }

export function onPageChange(fn: PageListener): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
}

function notify() { for (const fn of listeners) fn(currentPage); }

export function nextPage(totalPilots: number): void {
  const maxPage = Math.max(0, Math.ceil(totalPilots / PILOTS_PER_PAGE) - 1);
  currentPage = Math.min(currentPage + 1, maxPage);
  notify();
}

export function prevPage(): void {
  currentPage = Math.max(0, currentPage - 1);
  notify();
}

export function resetPage(): void {
  currentPage = 0;
  notify();
}

// Returns the pilot at slot index [0..4] for the current page, or null.
export function getPilotAtSlot<T>(pilots: T[], slotIndex: number): T | null {
  return pilots[currentPage * PILOTS_PER_PAGE + slotIndex] ?? null;
}
