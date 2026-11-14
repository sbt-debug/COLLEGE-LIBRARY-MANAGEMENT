import { useMemo, useState } from 'react';
import {
  BookMarked,
  Edit3,
  Eye,
  FileText,
  Globe,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  type MemberDTO,
  type ResourceDTO,
  ResourceStatus,
  ResourceType,
  UserRole,
} from '../domain/index.ts';
import { formatDate, getResourceTypeLabel } from '../utils/format.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface CatalogViewProps {
  user: MemberDTO;
  resources: ResourceDTO[];
  onAddResource: () => void;
  onEditResource: (resource: ResourceDTO) => void;
  onDeleteResource: (resource: ResourceDTO) => Promise<void>;
  onViewDetails: (resource: ResourceDTO) => void;
  onBorrow: (resourceId: string) => Promise<void>;
  onReturn: (resourceId: string) => Promise<void>;
  onReserve: (resourceId: string) => Promise<void>;
  busyId: string | null;
}

const TYPE_TABS: Array<{ key: 'ALL' | ResourceType; label: string }> = [
  { key: 'ALL', label: 'All Types' },
  { key: ResourceType.BOOK, label: 'Books' },
  { key: ResourceType.JOURNAL, label: 'Journals' },
  { key: ResourceType.MAGAZINE, label: 'Magazines' },
  { key: ResourceType.DIGITAL, label: 'Digital' },
];

const STATUS_OPTIONS: Array<{ key: 'ALL' | ResourceStatus; label: string }> = [
  { key: 'ALL', label: 'All Statuses' },
  { key: ResourceStatus.AVAILABLE, label: 'Available' },
  { key: ResourceStatus.BORROWED, label: 'Borrowed' },
  { key: ResourceStatus.RESERVED, label: 'Reserved' },
  { key: ResourceStatus.OVERDUE, label: 'Overdue' },
];

function ResourceIcon({ type }: { type: ResourceType }) {
  switch (type) {
    case ResourceType.BOOK:
      return <BookMarked className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />;
    case ResourceType.JOURNAL:
      return <FileText className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />;
    case ResourceType.MAGAZINE:
      return <Newspaper className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />;
    case ResourceType.DIGITAL:
      return <Globe className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />;
  }
}

export function CatalogView({
  user,
  resources,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onViewDetails,
  onBorrow,
  onReturn,
  onReserve,
  busyId,
}: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ResourceType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ResourceStatus>('ALL');

  const isLibrarian = user.role === UserRole.LIBRARIAN;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resources.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.authorOrPublisher.toLowerCase().includes(q) ||
        r.callNumber.toLowerCase().includes(q) ||
        (r.isbn && r.isbn.toLowerCase().includes(q)) ||
        (r.issn && r.issn.toLowerCase().includes(q))
      );
    });
  }, [resources, searchQuery, typeFilter, statusFilter]);

  const renderActions = (r: ResourceDTO) => {
    const isBorrowedByMe = r.currentBorrowerId === user.id;
    const isHeldForMe = r.status === ResourceStatus.RESERVED && r.heldForMemberId === user.id;
    const canBorrowNow =
      !isLibrarian && (r.status === ResourceStatus.AVAILABLE || isHeldForMe);
    const canReturnNow =
      (r.status === ResourceStatus.BORROWED || r.status === ResourceStatus.OVERDUE) &&
      (isBorrowedByMe || isLibrarian);
    const alreadyInQueue = r.reservationQueue.includes(user.id);
    const canReserveNow =
      !isLibrarian &&
      r.status !== ResourceStatus.AVAILABLE &&
      !isBorrowedByMe &&
      !isHeldForMe &&
      !alreadyInQueue;

    return (
      <div className="flex items-center justify-end gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onViewDetails(r)}
          aria-label={`Inspect details for ${r.title}`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Details</span>
        </button>

        {canBorrowNow && (
          <button
            type="button"
            disabled={busyId === r.id}
            onClick={() => onBorrow(r.id)}
            aria-label={`Borrow ${r.title}`}
            className="inline-flex items-center gap-1 rounded-md bg-blue-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap disabled:opacity-60"
          >
            <span>
              {busyId === r.id ? 'Borrowing...' : isHeldForMe ? 'Claim Hold' : 'Borrow'}
            </span>
          </button>
        )}

        {canReturnNow && (
          <button
            type="button"
            disabled={busyId === r.id}
            onClick={() => onReturn(r.id)}
            aria-label={`Return ${r.title}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{busyId === r.id ? 'Returning...' : 'Return'}</span>
          </button>
        )}

        {canReserveNow && (
          <button
            type="button"
            disabled={busyId === r.id}
            onClick={() => onReserve(r.id)}
            aria-label={`Reserve ${r.title}`}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap disabled:opacity-60"
          >
            <span>{busyId === r.id ? 'Reserving...' : 'Reserve'}</span>
          </button>
        )}

        {!isLibrarian && alreadyInQueue && !isHeldForMe && (
          <span className="text-xs font-medium text-amber-800 px-2 whitespace-nowrap">
            In Queue
          </span>
        )}

        {isLibrarian && (
          <>
            <button
              type="button"
              onClick={() => onEditResource(r)}
              aria-label={`Edit ${r.title}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              disabled={busyId === r.id || r.status !== ResourceStatus.AVAILABLE}
              onClick={() => onDeleteResource(r)}
              aria-label={`Delete ${r.title}`}
              title={
                r.status !== ResourceStatus.AVAILABLE
                  ? 'Only available items can be deleted'
                  : 'Delete resource'
              }
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 whitespace-nowrap disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Search, Type Segmented Tabs, Availability Filter, Add CTA */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="catalog-search" className="sr-only">
              Search catalog by title, author, call number, or ISBN/ISSN
            </label>
            <input
              id="catalog-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, author, call number, ISBN/ISSN..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="status-filter" className="sr-only">
                Filter by availability status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ResourceStatus)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isLibrarian && (
              <button
                type="button"
                onClick={onAddResource}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Resource</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <div
            role="tablist"
            aria-label="Filter catalog by resource type"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full"
          >
            {TYPE_TABS.map((tab) => {
              const active = typeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTypeFilter(tab.key)}
                  className={`rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 tabular-nums shrink-0">
            Showing {filtered.length} of {resources.length} catalog items
          </p>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            No matching resources found
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try clearing your search query or adjusting the type and availability filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Data Grid */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Title & Author / Publisher</th>
                  <th className="px-4 py-3">Type & Policy</th>
                  <th className="px-4 py-3">Call No.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due / Queue</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          <ResourceIcon type={r.type} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{r.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 truncate">
                            {r.authorOrPublisher} · {r.year}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-900">
                        {getResourceTypeLabel(r.type)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                        {r.loanPeriodDays}d ·{' '}
                        {r.dailyFineRate ? `₹${r.dailyFineRate}/day` : 'No fine'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {r.callNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {r.dueDate ? (
                        <span className="font-mono">{formatDate(r.dueDate)}</span>
                      ) : r.status === ResourceStatus.RESERVED ? (
                        <span className="text-amber-800 font-medium">Held for queue #1</span>
                      ) : (
                        <span>Ready</span>
                      )}
                      {r.reservationQueue.length > 0 && (
                        <span className="block text-[11px] text-slate-500">
                          {r.reservationQueue.length} in queue
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">{renderActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((r) => (
              <article
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {r.authorOrPublisher} · {r.year}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{getResourceTypeLabel(r.type)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{r.callNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {r.loanPeriodDays}d /{' '}
                    {r.dailyFineRate ? `₹${r.dailyFineRate} per day` : 'No fine'}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-end">
                  {renderActions(r)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
