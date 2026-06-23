import React from 'react';
import { motion } from 'framer-motion';

/**
 * Pagination — reusable page-navigation bar.
 *
 * Props:
 *   page        {number}   Current page (1-indexed)
 *   totalPages  {number}
 *   hasPrev     {boolean}
 *   hasNext     {boolean}
 *   onPrev      {Function}
 *   onNext      {Function}
 *   onPage      {Function}  Called with the target page number
 *   compact     {boolean}  If true, only show prev/next + "Page X of Y" (for sidebars)
 *   className   {string}   Extra wrapper classes
 */
export default function Pagination({
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onPage,
  compact = false,
  className = '',
}) {
  if (totalPages <= 1) return null;

  // Build page number windows: always show first, last, current ±1, with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const delta = 1; // pages either side of current
    const range = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) range.unshift('...');
    if (page + delta < totalPages - 1) range.push('...');

    pages.push(1);
    pages.push(...range);
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  const NavButton = ({ onClick, disabled, children, title }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-on-surface-variant'
          : 'hover:bg-[#bd9dff]/15 hover:text-[#bd9dff] text-on-surface-variant active:scale-95'
        }`}
    >
      {children}
    </button>
  );

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        <NavButton onClick={onPrev} disabled={!hasPrev} title="Previous page">
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </NavButton>
        <span className="text-[10px] text-on-surface-variant/60 font-bold tabular-nums">
          {page} / {totalPages}
        </span>
        <NavButton onClick={onNext} disabled={!hasNext} title="Next page">
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </NavButton>
      </div>
    );
  }

  const pageNums = getPageNumbers();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-center gap-1 ${className}`}
    >
      {/* Prev */}
      <NavButton onClick={onPrev} disabled={!hasPrev} title="Previous page">
        <span className="material-symbols-outlined text-sm">chevron_left</span>
      </NavButton>

      {/* Page numbers */}
      {pageNums.map((p, idx) =>
        p === '...' ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-8 h-8 flex items-center justify-center text-xs text-on-surface-variant/30 select-none"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95
              ${p === page
                ? 'bg-[#bd9dff] text-background shadow-lg shadow-[#bd9dff]/20'
                : 'hover:bg-[#bd9dff]/15 hover:text-[#bd9dff] text-on-surface-variant'
              }`}
          >
            {p}
          </button>
        ),
      )}

      {/* Next */}
      <NavButton onClick={onNext} disabled={!hasNext} title="Next page">
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </NavButton>
    </motion.div>
  );
}
