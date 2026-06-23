import { useState, useMemo, useCallback } from 'react';

/**
 * usePagination — generic pagination hook.
 *
 * @param {Array}  items     - The full array of items to paginate.
 * @param {number} pageSize  - Number of items per page.
 * @returns {{
 *   page: number,
 *   setPage: Function,
 *   totalPages: number,
 *   pageItems: Array,
 *   hasPrev: boolean,
 *   hasNext: boolean,
 *   goFirst: Function,
 *   goLast: Function,
 *   goPrev: Function,
 *   goNext: Function,
 *   resetPage: Function,
 * }}
 */
export function usePagination(items = [], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize],
  );

  // Clamp page when items shrink (e.g. after a filter or delete)
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  const goFirst  = useCallback(() => setPage(1), []);
  const goLast   = useCallback(() => setPage(totalPages), [totalPages]);
  const goPrev   = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext   = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);
  const resetPage = useCallback(() => setPage(1), []);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    hasPrev,
    hasNext,
    goFirst,
    goLast,
    goPrev,
    goNext,
    resetPage,
  };
}
