import { useMemo, useState } from 'react';
import { BookmarkX, RotateCcw, Search } from 'lucide-react';
import {
  type ReservationDTO,
  ReservationStatus,
  type ResourceDTO,
  type TransactionDTO,
  TransactionStatus,
} from '../domain/index.ts';
import {
  formatCurrency,
  formatDate,
  getOverdueDays,
  getResourceTypeLabel,
} from '../utils/format.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface TransactionsViewProps {
  resources: ResourceDTO[];
  transactions: TransactionDTO[];
  reservations: ReservationDTO[];
  onReturn: (resourceId: string) => Promise<void>;
  onCancelReservation: (reservationId: string) => Promise<void>;
  busyId: string | null;
  effectiveDate: string;
}

export function TransactionsView({
  resources,
  transactions,
  reservations,
  onReturn,
  onCancelReservation,
  busyId,
  effectiveDate,
}: TransactionsViewProps) {
  const [tab, setTab] = useState<'all' | 'overdue' | 'reservations'>('all');
  const [query, setQuery] = useState('');
  const resourceMap = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const filteredTx = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (tab === 'overdue') {
        const isOverdueOrUnpaid =
          t.status === TransactionStatus.OVERDUE || (t.fineAmount > 0 && !t.finePaid);
        if (!isOverdueOrUnpaid) return false;
      }
      if (!q) return true;
      return (
        t.resourceTitle.toLowerCase().includes(q) ||
        t.memberName.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [transactions, tab, query]);

  const filteredRes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations.filter((r) => {
      if (!q) return true;
      return (
        r.resourceTitle.toLowerCase().includes(q) ||
        r.memberName.toLowerCase().includes(q)
      );
    });
  }, [reservations, query]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Circulation ledger views"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 self-start"
        >
          {[
            { key: 'all' as const, label: `All Transactions (${transactions.length})` },
            {
              key: 'overdue' as const,
              label: `Overdue & Unpaid (${
                transactions.filter(
                  (t) =>
                    t.status === TransactionStatus.OVERDUE ||
                    (t.fineAmount > 0 && !t.finePaid)
                ).length
              })`,
            },
            {
              key: 'reservations' as const,
              label: `Reservation Queue (${
                reservations.filter(
                  (r) =>
                    r.status === ReservationStatus.WAITING ||
                    r.status === ReservationStatus.HELD
                ).length
              })`,
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === item.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="ledger-search" className="sr-only">
            Search transactions or reservations
          </label>
          <input
            id="ledger-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by resource or member..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
      </div>

      {tab === 'reservations' ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          {filteredRes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No reservation queue records match your filter.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Reserved On</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRes.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{r.resourceTitle}</p>
                      <p className="text-xs text-slate-500">
                        {getResourceTypeLabel(r.resourceType)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-800">
                      {r.memberName}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(r.reservedAt)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums font-semibold text-slate-900">
                      #{r.queuePosition}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(r.status === ReservationStatus.WAITING ||
                        r.status === ReservationStatus.HELD) && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => onCancelReservation(r.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <BookmarkX className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          {filteredTx.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No transactions match this filter.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Borrowed</th>
                  <th className="px-4 py-3">Due / Returned</th>
                  <th className="px-4 py-3">Fine</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTx.map((tx) => {
                  const overdueDays =
                    tx.status === TransactionStatus.RETURNED
                      ? 0
                      : getOverdueDays(tx.dueDate, effectiveDate);
                  const dailyRate = resourceMap.get(tx.resourceId)?.dailyFineRate ?? 0;
                  const estimatedFine =
                    tx.status !== TransactionStatus.RETURNED ? overdueDays * dailyRate : 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{tx.resourceTitle}</p>
                        <p className="text-xs text-slate-500">
                          {getResourceTypeLabel(tx.resourceType)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-800">
                        {tx.memberName}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDate(tx.borrowDate)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                        <span>Due {formatDate(tx.dueDate)}</span>
                        {tx.returnDate && (
                          <span className="block text-[11px] text-slate-500">
                            Ret {formatDate(tx.returnDate)}
                          </span>
                        )}
                        {overdueDays > 0 && (
                          <span className="block text-[11px] font-semibold text-rose-700">
                            {overdueDays}d overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums whitespace-nowrap">
                        {tx.status !== TransactionStatus.RETURNED && estimatedFine > 0 ? (
                          <>
                            <span className="font-semibold text-rose-700">
                              {formatCurrency(estimatedFine)}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Estimated (₹{dailyRate}/d)
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className={`font-semibold ${
                                tx.fineAmount > 0 && !tx.finePaid
                                  ? 'text-rose-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {formatCurrency(tx.fineAmount)}
                            </span>
                            {tx.fineAmount > 0 && (
                              <span className="block text-[11px] text-slate-500">
                                {tx.finePaid ? 'Paid' : 'Unpaid'}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {tx.status !== TransactionStatus.RETURNED && (
                          <button
                            type="button"
                            disabled={busyId === tx.resourceId}
                            onClick={() => onReturn(tx.resourceId)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap disabled:opacity-60"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {busyId === tx.resourceId ? 'Returning...' : 'Process Return'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
