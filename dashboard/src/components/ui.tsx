import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    PUBLISHED: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    POSTED: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    PENDING: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
    FAILED: 'bg-red-500/15 text-red-400 ring-red-500/30',
    REJECTED: 'bg-red-500/15 text-red-400 ring-red-500/30',
  };

  const style =
    colors[status] ?? 'bg-slate-500/15 text-slate-400 ring-slate-500/30';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style} ${className}`}
    >
      {status}
    </span>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  descriptionClassName = 'text-slate-400',
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description ? (
          <p className={cn('mt-1 text-sm', descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        {message}
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-400 hover:text-red-300"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

interface SuccessBannerProps {
  message: string;
}

export function SuccessBanner({ message }: SuccessBannerProps) {
  return (
    <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
      {message}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface JsonLogProps {
  data: unknown;
  title?: string;
}

export function JsonLog({ data, title = 'Server Response' }: JsonLogProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/80">
      <div className="border-b border-slate-700 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <pre className="max-h-72 overflow-auto p-3 text-xs leading-relaxed text-emerald-300 sm:max-h-96 sm:p-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

interface PaginatedPageLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

/** Keeps pagination pinned to the bottom when the list is shorter than the viewport. */
export function PaginatedPageLayout({ children, footer }: PaginatedPageLayoutProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {children}
      {footer ? <div className="mt-auto w-full shrink-0 pt-6">{footer}</div> : null}
    </div>
  );
}

interface PaginationFooterProps {
  children: ReactNode;
  className?: string;
}

export function PaginationFooter({ children, className }: PaginationFooterProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60', className)}
    >
      {children}
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'posts',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  const pages: number[] = [];
  const windowSize = 5;
  let rangeStart = Math.max(1, safePage - Math.floor(windowSize / 2));
  const rangeEnd = Math.min(totalPages, rangeStart + windowSize - 1);
  rangeStart = Math.max(1, rangeEnd - windowSize + 1);
  for (let i = rangeStart; i <= rangeEnd; i += 1) {
    pages.push(i);
  }

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-slate-800 bg-slate-900/60 px-3 py-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-slate-400">
        Showing <span className="font-medium text-slate-200">{start}</span>-
        <span className="font-medium text-slate-200">{end}</span> of{' '}
        <span className="font-medium text-slate-200">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-9 rounded-md px-3 py-1.5 text-sm ${
                p === safePage
                  ? 'bg-emerald-600 font-medium text-white'
                  : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
