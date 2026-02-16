"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  onRowClick?: (row: T) => void;
  paginated?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  stickyHeader?: boolean;
  className?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  actions?: (row: T) => React.ReactNode;
  bulkActions?: React.ReactNode;
  filters?: React.ReactNode;
  compact?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchFields,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onRowClick,
  paginated = true,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'No data found',
  emptyIcon,
  stickyHeader = true,
  className,
  rowClassName,
  actions,
  bulkActions,
  filters,
  compact = false,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    const fieldsToSearch = searchFields || (columns.map(c => c.key) as (keyof T)[]);

    return data.filter(row =>
      fieldsToSearch.some(field => {
        const value = row[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, searchFields, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, paginated]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle sort
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortKey, sortDirection]);

  // Handle selection
  const isSelected = useCallback((row: T) => {
    return selectedRows.some(r => r[keyField] === row[keyField]);
  }, [selectedRows, keyField]);

  const handleSelectRow = useCallback((row: T) => {
    if (!onSelectionChange) return;

    if (isSelected(row)) {
      onSelectionChange(selectedRows.filter(r => r[keyField] !== row[keyField]));
    } else {
      onSelectionChange([...selectedRows, row]);
    }
  }, [isSelected, selectedRows, onSelectionChange, keyField]);

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedRows.length === paginatedData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...paginatedData]);
    }
  }, [selectedRows, paginatedData, onSelectionChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!tableRef.current?.contains(document.activeElement)) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedRowIndex(prev => Math.min(prev + 1, paginatedData.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedRowIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedRowIndex >= 0 && onRowClick) {
            onRowClick(paginatedData[focusedRowIndex]);
          }
          break;
        case ' ':
          e.preventDefault();
          if (focusedRowIndex >= 0 && selectable) {
            handleSelectRow(paginatedData[focusedRowIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedRowIndex, paginatedData, onRowClick, selectable, handleSelectRow]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const SortIcon = ({ column }: { column: Column<T> }) => {
    if (!column.sortable) return null;

    const isSorted = sortKey === column.key;

    return (
      <span className="ml-1 inline-flex">
        {!isSorted && <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-500" />}
        {isSorted && sortDirection === 'asc' && <ChevronUp className="w-3.5 h-3.5 text-ql-yellow" />}
        {isSorted && sortDirection === 'desc' && <ChevronDown className="w-3.5 h-3.5 text-ql-yellow" />}
      </span>
    );
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={cn("bg-dark-card border border-border rounded-xl overflow-hidden", className)}>
      {/* Toolbar */}
      {(searchable || filters || bulkActions) && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {searchable && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-tertiary border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-ql-yellow focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {filters}
          </div>

          {selectedRows.length > 0 && bulkActions && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">
                {selectedRows.length} selected
              </span>
              {bulkActions}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div ref={tableRef} className="overflow-x-auto" tabIndex={0}>
        <table className="w-full">
          <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
            <tr className="bg-dark-secondary border-b border-border">
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <button
                    onClick={handleSelectAll}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                      selectedRows.length === paginatedData.length && paginatedData.length > 0
                        ? "bg-ql-yellow border-ql-yellow"
                        : "border-border hover:border-zinc-500"
                    )}
                  >
                    {selectedRows.length === paginatedData.length && paginatedData.length > 0 && (
                      <Check className="w-3.5 h-3.5 text-black" />
                    )}
                  </button>
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    cellPadding,
                    "text-xs font-semibold uppercase tracking-wider text-zinc-400",
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.sortable && 'cursor-pointer select-none hover:text-white transition-colors',
                    column.className
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <span className="inline-flex items-center">
                    {column.header}
                    <SortIcon column={column} />
                  </span>
                </th>
              ))}
              {actions && (
                <th className="w-10 px-3 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="py-12">
                  <div className="flex flex-col items-center justify-center text-zinc-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-sm">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="py-12">
                  <div className="flex flex-col items-center justify-center text-zinc-500">
                    {emptyIcon || <Filter className="w-8 h-8 mb-2 text-zinc-600" />}
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowKey = String(row[keyField]);
                const isRowSelected = isSelected(row);
                const isFocused = focusedRowIndex === index;
                const computedRowClassName = typeof rowClassName === 'function'
                  ? rowClassName(row, index)
                  : rowClassName;

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer",
                      isRowSelected && "bg-ql-yellow/10",
                      isFocused && "ring-1 ring-inset ring-ql-yellow",
                      !isRowSelected && "hover:bg-dark-tertiary/50",
                      computedRowClassName
                    )}
                    onClick={() => onRowClick?.(row)}
                    onFocus={() => setFocusedRowIndex(index)}
                  >
                    {selectable && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectRow(row)}
                          className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                            isRowSelected
                              ? "bg-ql-yellow border-ql-yellow"
                              : "border-border hover:border-zinc-500"
                          )}
                        >
                          {isRowSelected && <Check className="w-3.5 h-3.5 text-black" />}
                        </button>
                      </td>
                    )}
                    {columns.map((column) => {
                      const value = row[column.key as keyof T];
                      const rendered = column.render
                        ? column.render(row, index)
                        : String(value ?? '');

                      return (
                        <td
                          key={String(column.key)}
                          className={cn(
                            cellPadding,
                            "text-sm text-white",
                            column.align === 'center' && 'text-center',
                            column.align === 'right' && 'text-right',
                            column.className
                          )}
                        >
                          {rendered}
                        </td>
                      );
                    })}
                    {actions && (
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && !loading && sortedData.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-dark-tertiary border border-border rounded px-2 py-1 text-sm text-white focus:border-ql-yellow focus:outline-none"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded hover:bg-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-400" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded hover:bg-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Convenience components for DataTable
export function DataTableStatusBadge({
  status,
  variant = 'default',
}: {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
}) {
  const variantClasses = {
    success: 'bg-accent-green/10 text-accent-green border-accent-green/20',
    warning: 'bg-ql-yellow/10 text-ql-yellow border-ql-yellow/20',
    danger: 'bg-accent-red/10 text-accent-red border-accent-red/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    default: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      variantClasses[variant]
    )}>
      {status}
    </span>
  );
}

export function DataTableActionButton({
  children,
  onClick,
  variant = 'default',
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-dark-tertiary transition-colors",
        variant === 'danger' && "text-accent-red hover:bg-accent-red/10"
      )}
    >
      {children}
    </button>
  );
}
