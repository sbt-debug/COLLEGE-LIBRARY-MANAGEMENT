import {
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  ReservationStatus,
  ResourceStatus,
  TransactionStatus,
} from '../domain/index.ts';

type BadgeStatus = ResourceStatus | TransactionStatus | ReservationStatus;

const BADGE_STYLES: Record<
  string,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  [ResourceStatus.AVAILABLE]: {
    label: 'Available',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
  },
  [ResourceStatus.BORROWED]: {
    label: 'Borrowed',
    classes: 'bg-blue-50 text-blue-800 border-blue-200',
    Icon: Clock,
  },
  [ResourceStatus.RESERVED]: {
    label: 'Reserved',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: BookmarkCheck,
  },
  [ResourceStatus.OVERDUE]: {
    label: 'Overdue',
    classes: 'bg-rose-50 text-rose-800 border-rose-200',
    Icon: AlertTriangle,
  },
  [TransactionStatus.ACTIVE]: {
    label: 'Active Loan',
    classes: 'bg-blue-50 text-blue-800 border-blue-200',
    Icon: Clock,
  },
  [TransactionStatus.RETURNED]: {
    label: 'Returned',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    Icon: CheckCircle2,
  },
  [ReservationStatus.WAITING]: {
    label: 'In Queue',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: Clock,
  },
  [ReservationStatus.HELD]: {
    label: 'Held for Pickup',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: BookmarkCheck,
  },
  [ReservationStatus.FULFILLED]: {
    label: 'Fulfilled',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    Icon: CheckCircle2,
  },
  [ReservationStatus.CANCELLED]: {
    label: 'Cancelled',
    classes: 'bg-slate-100 text-slate-500 border-slate-200',
    Icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const config = BADGE_STYLES[status] ?? {
    label: status,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    Icon: Clock,
  };
  const { label, classes, Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
