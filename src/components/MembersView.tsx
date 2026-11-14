import { useMemo, useState } from 'react';
import { CreditCard, Search, UserPlus } from 'lucide-react';
import { type MemberDTO, MemberType } from '../domain/index.ts';
import { formatCurrency } from '../utils/format.ts';

interface MembersViewProps {
  members: MemberDTO[];
  onAddMember: () => void;
  onCollectFine: (memberId: string) => Promise<void>;
  busyId: string | null;
}

export function MembersView({
  members,
  onAddMember,
  onCollectFine,
  busyId,
}: MembersViewProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MemberType>('ALL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (typeFilter !== 'ALL' && m.memberType !== typeFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.studentOrStaffId.toLowerCase().includes(q)
      );
    });
  }, [members, query, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="member-search" className="sr-only">
              Search members
            </label>
            <input
              id="member-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, department..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter members by account type"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start"
          >
            {[
              { key: 'ALL' as const, label: 'All Members' },
              { key: MemberType.STUDENT, label: 'Students (Limit 3)' },
              { key: MemberType.FACULTY, label: 'Faculty (Limit 5)' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={typeFilter === tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onAddMember}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Register Member</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-5 py-3">Member</th>
              <th className="px-4 py-3">College ID</th>
              <th className="px-4 py-3">Role / Department</th>
              <th className="px-4 py-3">Active Quota</th>
              <th className="px-4 py-3">Unpaid Fines</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                  {m.studentOrStaffId}
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-xs font-medium text-slate-900">
                    {m.memberType === MemberType.FACULTY ? 'FacultyMember' : 'StudentMember'}
                  </p>
                  <p className="text-xs text-slate-500">{m.department}</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                  {m.activeBorrowCount} / {m.borrowLimit} items
                </td>
                <td className="px-4 py-3.5 font-mono text-xs tabular-nums font-semibold whitespace-nowrap">
                  {m.unpaidFines > 0 ? (
                    <span className="text-rose-700">{formatCurrency(m.unpaidFines)}</span>
                  ) : (
                    <span className="text-emerald-700">Clear (₹0.00)</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {m.unpaidFines > 0 ? (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => onCollectFine(m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 whitespace-nowrap disabled:opacity-60"
                    >
                      <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{busyId === m.id ? 'Settling...' : 'Collect Fine'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Eligible</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
