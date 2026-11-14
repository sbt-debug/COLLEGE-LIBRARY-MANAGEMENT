import { AlertTriangle, BookmarkX, CreditCard, RotateCcw } from 'lucide-react';
import {
  type MemberDTO,
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

interface MyCirculationViewProps {
  user: MemberDTO;
  resources: ResourceDTO[];
  transactions: TransactionDTO[];
  reservations: ReservationDTO[];
  onReturn: (resourceId: string) => Promise<void>;
  onBorrow: (resourceId: string) => Promise<void>;
  onCancelReservation: (reservationId: string) => Promise<void>;
  onPayFine: () => Promise<void>;
  busyId: string | null;
  effectiveDate: string;
}

export function MyCirculationView({
  user,
  resources,
  transactions,
  reservations,
  onReturn,
  onBorrow,
  onCancelReservation,
  onPayFine,
  busyId,
  effectiveDate,
}: MyCirculationViewProps) {
  const activeLoans = transactions.filter(
    (t) => t.status === TransactionStatus.ACTIVE || t.status === TransactionStatus.OVERDUE
  );
  const pastLoans = transactions.filter((t) => t.status === TransactionStatus.RETURNED);
  const activeReservations = reservations.filter(
    (r) => r.status === ReservationStatus.WAITING || r.status === ReservationStatus.HELD
  );

  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Borrow Quota Used</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {user.activeBorrowCount} / {user.borrowLimit}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {user.memberType === 'FACULTY' ? 'Faculty Allowance' : 'Student Allowance'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Active Reservations</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
            {activeReservations.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeReservations.filter((r) => r.status === ReservationStatus.HELD).length} ready
            for pickup
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Unpaid Fines</p>
            <p
              className={`mt-2 font-display text-2xl font-bold tabular-nums ${
                user.unpaidFines > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatCurrency(user.unpaidFines)}
            </p>
          </div>
          {user.unpaidFines > 0 && (
            <button
              type="button"
              disabled={busyId === 'pay-fine'}
              onClick={onPayFine}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{busyId === 'pay-fine' ? 'Paying...' : 'Pay Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Borrowed Items */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Currently Borrowed Items
          </h2>
          <p className="text-xs text-slate-500">
            Return items on or before the due date to avoid type-specific overdue fines
          </p>
        </div>

        {activeLoans.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            You have no active borrowed items.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-4 py-3">Borrowed On</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Estimated Fine</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeLoans.map((tx) => {
                  const res = resourceMap.get(tx.resourceId);
                  const overdueDays = getOverdueDays(tx.dueDate, effectiveDate);
                  const dailyRate = res?.dailyFineRate ?? 0;
                  const estimatedFine = overdueDays * dailyRate;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">{tx.resourceTitle}</p>
                        <p className="text-xs text-slate-500">
                          {getResourceTypeLabel(tx.resourceType)} ·{' '}
                          {dailyRate > 0 ? `₹${dailyRate}/day if overdue` : 'No overdue fine'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDate(tx.borrowDate)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-900 whitespace-nowrap">
                        {formatDate(tx.dueDate)}
                        {overdueDays > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-rose-700 font-medium">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {overdueDays}d overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {estimatedFine > 0 ? (
                          <span className="text-rose-700">{formatCurrency(estimatedFine)}</span>
                        ) : (
                          '₹0.00'
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={busyId === tx.resourceId}
                          onClick={() => onReturn(tx.resourceId)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{busyId === tx.resourceId ? 'Returning...' : 'Return Item'}</span>
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

      {/* Reservations Queue */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            My Reservation Queue
          </h2>
          <p className="text-xs text-slate-500">
            Items marked Held for Pickup can be borrowed directly by you
          </p>
        </div>

        {activeReservations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            You have no active reservations. Reserve any borrowed item from the Catalog.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-4 py-3">Reserved On</th>
                  <th className="px-4 py-3">Queue Position</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{res.resourceTitle}</p>
                      <p className="text-xs text-slate-500">
                        {getResourceTypeLabel(res.resourceType)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(res.reservedAt)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums font-semibold text-slate-900">
                      #{res.queuePosition}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={res.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {res.status === ReservationStatus.HELD && (
                        <button
                          type="button"
                          disabled={busyId === res.resourceId}
                          onClick={() => onBorrow(res.resourceId)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                          Borrow Now
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === res.id}
                        onClick={() => onCancelReservation(res.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <BookmarkX className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cancel</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Past Loan History */}
      {pastLoans.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Returned History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-4 py-3">Borrowed</th>
                  <th className="px-4 py-3">Returned</th>
                  <th className="px-4 py-3">Fine Charged</th>
                  <th className="px-5 py-3 text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pastLoans.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {tx.resourceTitle}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(tx.borrowDate)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(tx.returnDate)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-900">
                      {formatCurrency(tx.fineAmount)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-medium">
                      {tx.fineAmount === 0 ? (
                        <span className="text-slate-500">No fine</span>
                      ) : tx.finePaid ? (
                        <span className="text-emerald-700">Paid</span>
                      ) : (
                        <span className="text-rose-700">Unpaid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
