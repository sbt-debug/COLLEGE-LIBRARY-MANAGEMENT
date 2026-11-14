import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import {
  type DashboardStatsDTO,
  type MemberDTO,
  type ReservationDTO,
  ReservationStatus,
  type ResourceDTO,
  ResourceType,
  type TransactionDTO,
  TransactionStatus,
  UserRole,
} from '../domain/index.ts';
import {
  formatCurrency,
  formatDate,
  getOverdueDays,
  getResourceTypeLabel,
} from '../utils/format.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface DashboardViewProps {
  user: MemberDTO;
  stats: DashboardStatsDTO;
  resources: ResourceDTO[];
  transactions: TransactionDTO[];
  reservations: ReservationDTO[];
  onNavigate: (tab: string) => void;
  onReturnResource: (resourceId: string) => Promise<void>;
  onPayFine: (memberId?: string) => Promise<void>;
  busyId: string | null;
  effectiveDate: string;
}

export function DashboardView({
  user,
  stats,
  resources,
  transactions,
  reservations,
  onNavigate,
  onReturnResource,
  onPayFine,
  busyId,
  effectiveDate,
}: DashboardViewProps) {
  const isLibrarian = user.role === UserRole.LIBRARIAN;

  const activeLoans = transactions.filter(
    (t) => t.status === TransactionStatus.ACTIVE || t.status === TransactionStatus.OVERDUE
  );
  const myReservations = reservations.filter(
    (r) => r.status === ReservationStatus.WAITING || r.status === ReservationStatus.HELD
  );

  const typeSummary = [
    {
      type: ResourceType.BOOK,
      label: 'Books',
      policy: '14 days · ₹2/day',
      count: resources.filter((r) => r.type === ResourceType.BOOK).length,
    },
    {
      type: ResourceType.JOURNAL,
      label: 'Journals',
      policy: '7 days · ₹5/day',
      count: resources.filter((r) => r.type === ResourceType.JOURNAL).length,
    },
    {
      type: ResourceType.MAGAZINE,
      label: 'Magazines',
      policy: '5 days · ₹3/day',
      count: resources.filter((r) => r.type === ResourceType.MAGAZINE).length,
    },
    {
      type: ResourceType.DIGITAL,
      label: 'Digital Resources',
      policy: '3 days · ₹0/day',
      count: resources.filter((r) => r.type === ResourceType.DIGITAL).length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Unpaid fine alert for members */}
      {!isLibrarian && user.unpaidFines > 0 && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-rose-950">
                Borrowing Paused — Unpaid Fine Balance: {formatCurrency(user.unpaidFines)}
              </h2>
              <p className="mt-0.5 text-xs text-rose-800">
                Settle your outstanding overdue fine to resume borrowing new library resources.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busyId === 'pay-fine'}
            onClick={() => onPayFine()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{busyId === 'pay-fine' ? 'Processing...' : `Pay ${formatCurrency(user.unpaidFines)}`}</span>
          </button>
        </div>
      )}

      {/* KPI Metrics Row */}
      <section aria-label="Library overview metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Resources</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {stats.totalResources}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {stats.availableCount} available · {stats.reservedCount} held
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Currently Borrowed</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {stats.borrowedCount}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {stats.activeReservations} active queue reservations
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Overdue Items</p>
          <p
            className={`mt-2 font-display text-2xl font-bold tabular-nums ${
              stats.overdueCount > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {stats.overdueCount}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {formatCurrency(stats.totalUnpaidFines)} unpaid member fines
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Fines Collected</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatCurrency(stats.totalFinesCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {stats.totalMembers} registered members
          </p>
        </div>
      </section>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Circulation / Overdue Watchlist */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isLibrarian ? 'Active & Overdue Circulation' : 'My Borrowed Resources'}
              </h2>
              <p className="text-xs text-slate-500">
                {isLibrarian
                  ? 'Live loans requiring tracking or overdue fine recovery'
                  : `Using ${user.activeBorrowCount} of ${user.borrowLimit} allowed slots (${user.memberType?.toLowerCase()} limit)`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(isLibrarian ? 'transactions' : 'my-loans')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-950 whitespace-nowrap shrink-0"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {activeLoans.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                No active loans at the moment
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Browse the library catalog to borrow books, journals, magazines, or digital packs.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-5 py-3">Resource</th>
                    {isLibrarian && <th className="px-4 py-3">Member</th>}
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeLoans.slice(0, 6).map((tx) => {
                    const overdueDays = getOverdueDays(tx.dueDate, effectiveDate);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{tx.resourceTitle}</p>
                          <p className="text-xs text-slate-500">
                            {getResourceTypeLabel(tx.resourceType)}
                          </p>
                        </td>
                        {isLibrarian && (
                          <td className="px-4 py-3 text-xs text-slate-700">
                            {tx.memberName}
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {formatDate(tx.dueDate)}
                          {overdueDays > 0 && (
                            <span className="block text-rose-700 font-medium">
                              {overdueDays}d overdue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={tx.status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            disabled={busyId === tx.resourceId}
                            onClick={() => onReturnResource(tx.resourceId)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap disabled:opacity-60"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{busyId === tx.resourceId ? 'Returning...' : 'Return'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: Collection Breakdown & My Reservations */}
        <section className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Holdings by Resource Class
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Polymorphic loan periods & daily fine rates
            </p>
            <div className="mt-4 divide-y divide-slate-200">
              {typeSummary.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs font-mono tabular-nums text-slate-500">
                      {item.policy}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {isLibrarian ? 'Reservation Queue' : 'My Reservations'}
              </h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {myReservations.length} active
              </span>
            </div>

            {myReservations.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                No active reservations in queue.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200">
                {myReservations.slice(0, 4).map((res) => (
                  <li key={res.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {res.resourceTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {isLibrarian ? `${res.memberName} · ` : ''}
                          Queue #{res.queuePosition}
                        </p>
                      </div>
                      <StatusBadge status={res.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
