'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, ChevronDown, Package, Search, X } from 'lucide-react';
import {
  filterProductOptions,
  findSelectedProductOption,
} from '../../lib/utils/productSearch.js';

export default function SearchableProductSelect({
  id: providedId,
  name,
  label,
  ariaLabel,
  required = false,
  disabled = false,
  placeholder = 'Cari dan pilih produk...',
  searchPlaceholder = 'Cari nama atau SKU produk...',
  emptyTitle = 'Produk tidak ditemukan',
  emptyDescription = 'Ubah kata kunci pencarian nama atau SKU untuk menemukan produk.',
  products = [],
  value = '',
  onChange,
  isOptionDisabled = null,
  getOptionMeta = null,
  getOptionBadge = null,
  error = '',
  helperText = '',
  triggerClassName = '',
  className = '',
}) {
  const autoId = useId();
  const triggerId = providedId || `product-select-${autoId}`;
  const listboxId = `${triggerId}-listbox`;
  const searchId = `${triggerId}-search`;
  const errorId = `${triggerId}-error`;
  const helperId = `${triggerId}-helper`;

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [panelStyle, setPanelStyle] = useState(null);

  const selectedProduct = useMemo(
    () => findSelectedProductOption(products, value),
    [products, value]
  );

  const filteredProducts = useMemo(
    () => filterProductOptions(products, searchQuery),
    [products, searchQuery]
  );

  function computeOptionDisabled(product) {
    return typeof isOptionDisabled === 'function' ? Boolean(isOptionDisabled(product)) : false;
  }

  function defaultOptionMeta(product) {
    if (typeof getOptionMeta === 'function') {
      return getOptionMeta(product);
    }
    const parts = [];
    if (product?.sku) parts.push(`SKU: ${product.sku}`);
    if (product?.stock !== undefined && product?.stock !== null) {
      parts.push(`Stok: ${product.stock} ${product.unit || 'unit'}`);
    }
    if (product?.category_name) parts.push(product.category_name);
    return parts.join(' • ');
  }

  function closePanel({ restoreFocus = false } = {}) {
    setOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    const panel = panelRef.current;
    if (panel && typeof panel.hidePopover === 'function') {
      try {
        if (panel.matches(':popover-open')) {
          panel.hidePopover();
        }
      } catch {
        // Ignore popover close errors in unsupported environments
      }
    }
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

  function updatePanelPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight || 720;
    const viewportW = window.innerWidth || 1024;
    const gutter = 8;
    const gap = 6;
    const estimatedPanelHeight = 310;

    const spaceBelow = viewportH - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const openUpward = spaceBelow < 235 && spaceAbove > spaceBelow;

    const minDesiredWidth = Math.max(rect.width, 300);
    const width = Math.min(minDesiredWidth, viewportW - gutter * 2);
    let left = rect.left;
    if (left + width > viewportW - gutter) {
      left = Math.max(gutter, viewportW - gutter - width);
    }
    left = Math.max(gutter, left);

    const availableSpace = Math.max(
      170,
      Math.min(estimatedPanelHeight, openUpward ? spaceAbove - gap : spaceBelow - gap)
    );

    const top = openUpward
      ? Math.max(gutter, rect.top - availableSpace - gap)
      : rect.bottom + gap;

    setPanelStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(availableSpace)}px`,
      margin: 0,
      zIndex: 90,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();

    const panel = panelRef.current;
    if (panel && typeof panel.showPopover === 'function') {
      try {
        if (!panel.matches(':popover-open')) {
          panel.showPopover();
        }
      } catch {
        // Fallback smoothly to fixed positioning when popover API is unavailable
      }
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleViewportChange() {
      updatePanelPosition();
    }

    function handlePointerDown(event) {
      const target = event.target;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closePanel({ restoreFocus: false });
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open]);

  function findNextEnabledIndex(startIndex, step) {
    if (filteredProducts.length === 0) return -1;
    for (let i = 0; i < filteredProducts.length; i++) {
      const candidate =
        (startIndex + step * (i + 1) + filteredProducts.length) %
        filteredProducts.length;
      if (!computeOptionDisabled(filteredProducts[candidate])) {
        return candidate;
      }
    }
    return -1;
  }

  function handleSelectProduct(product) {
    if (!product || computeOptionDisabled(product)) return;
    onChange?.(String(product.id), product);
    closePanel({ restoreFocus: true });
  }

  function handleTriggerClick() {
    if (disabled) return;
    if (open) {
      closePanel({ restoreFocus: false });
    } else {
      const currentIdx = filteredProducts.findIndex(
        (item) => String(item.id) === String(value)
      );
      setHighlightedIndex(
        currentIdx >= 0 && !computeOptionDisabled(filteredProducts[currentIdx])
          ? currentIdx
          : findNextEnabledIndex(-1, 1)
      );
      setOpen(true);
    }
  }

  function handlePanelKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePanel({ restoreFocus: true });
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const next = findNextEnabledIndex(prev, 1);
        scrollOptionIntoView(next);
        return next;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => {
        const next = findNextEnabledIndex(prev < 0 ? 0 : prev, -1);
        scrollOptionIntoView(next);
        return next;
      });
      return;
    }

    if (event.key === 'Enter' && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        const candidate = filteredProducts[highlightedIndex];
        if (!computeOptionDisabled(candidate)) {
          handleSelectProduct(candidate);
        }
      }
    }
  }

  function scrollOptionIntoView(index) {
    if (index < 0) return;
    requestAnimationFrame(() => {
      const optionEl = listboxRef.current?.children?.[index];
      optionEl?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  const describedBy =
    [error ? errorId : null, helperText && !error ? helperId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div ref={containerRef} className={`w-full relative ${className}`}>
      {label && (
        <label
          htmlFor={triggerId}
          className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {required && (
            <span className="text-[#FF3D8B] ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {name && <input type="hidden" name={name} value={value || ''} />}

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={handleTriggerClick}
        aria-label={!label ? ariaLabel || placeholder : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`w-full min-h-[40px] flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer ${
          error
            ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-200'
            : open
              ? 'border-[#3243DD] ring-2 ring-[#3243DD]/20'
              : 'border-slate-300 hover:border-slate-400 focus-visible:border-[#3243DD] focus-visible:ring-[#3243DD]/20'
        } ${triggerClassName}`}
      >
        <div className="min-w-0 flex-1">
          {selectedProduct ? (
            <div className="flex flex-col">
              <span className="truncate font-medium text-slate-900 text-xs sm:text-sm">
                {selectedProduct.name}
              </span>
              <span className="truncate text-[11px] text-slate-500">
                {defaultOptionMeta(selectedProduct)}
              </span>
            </div>
          ) : (
            <span className="truncate text-slate-400 text-xs sm:text-sm">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180 text-[#3243DD]' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          style={panelStyle || undefined}
          onKeyDown={handlePanelKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 bg-[#F4F5F8]/80 p-2.5 shrink-0">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id={searchId}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setSearchQuery(next);
                  const nextMatches = filterProductOptions(products, next);
                  const firstEnabled = nextMatches.findIndex(
                    (item) => !computeOptionDisabled(item)
                  );
                  setHighlightedIndex(firstEnabled);
                }}
                placeholder={searchPlaceholder}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-label="Cari produk berdasarkan nama atau SKU"
                className="w-full min-h-[36px] rounded-lg border border-slate-300 bg-white pl-8 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setHighlightedIndex(-1);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Hapus kata kunci pencarian"
                  className="absolute right-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-0.5 text-[11px] text-slate-500">
              Menampilkan {filteredProducts.length} dari {products.length} produk
            </p>
          </div>

          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={label || ariaLabel || 'Daftar produk'}
            className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5"
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => {
                const isSelected = String(product.id) === String(value);
                const isDisabledOpt = computeOptionDisabled(product);
                const isHighlighted = index === highlightedIndex;
                const badge =
                  typeof getOptionBadge === 'function' ? getOptionBadge(product) : null;
                const metaText = defaultOptionMeta(product);

                return (
                  <li
                    key={product.id}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabledOpt ? 'true' : undefined}
                    onMouseEnter={() => {
                      if (!isDisabledOpt) setHighlightedIndex(index);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      if (!isDisabledOpt) handleSelectProduct(product);
                    }}
                    className={`flex items-start justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isDisabledOpt
                        ? 'opacity-50 cursor-not-allowed bg-slate-50/70'
                        : isSelected
                          ? 'bg-[#EEF1FD] text-[#2635BC] cursor-pointer'
                          : isHighlighted
                            ? 'bg-slate-100 text-slate-900 cursor-pointer'
                            : 'hover:bg-slate-50 text-slate-800 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold truncate">
                          {product.name}
                        </span>
                        {badge && (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              badge.toneClass || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {badge.text}
                          </span>
                        )}
                      </div>
                      {metaText && (
                        <p className="mt-0.5 text-[11px] text-slate-500 break-words">
                          {metaText}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check
                        className="mt-0.5 h-4 w-4 text-[#3243DD] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-6 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Package className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800">
                  {emptyTitle}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {searchQuery
                    ? `Tidak ada produk yang cocok dengan "${searchQuery}".`
                    : emptyDescription}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setHighlightedIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset Pencarian
                  </button>
                )}
              </li>
            )}
          </ul>
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1 text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
