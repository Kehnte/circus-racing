// pilot-pager.ts — Manages which pilot page is currently visible (5 pilots per page).
export const PILOTS_PER_PAGE = 5;
let currentPage = 0;
const listeners = [];
export function getCurrentPage() { return currentPage; }
export function onPageChange(fn) {
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if (i !== -1)
        listeners.splice(i, 1); };
}
function notify() { for (const fn of listeners)
    fn(currentPage); }
export function nextPage(totalPilots) {
    const maxPage = Math.max(0, Math.ceil(totalPilots / PILOTS_PER_PAGE) - 1);
    currentPage = Math.min(currentPage + 1, maxPage);
    notify();
}
export function prevPage() {
    currentPage = Math.max(0, currentPage - 1);
    notify();
}
export function resetPage() {
    currentPage = 0;
    notify();
}
// Returns the pilot at slot index [0..4] for the current page, or null.
export function getPilotAtSlot(pilots, slotIndex) {
    return pilots[currentPage * PILOTS_PER_PAGE + slotIndex] ?? null;
}
