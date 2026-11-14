import { useCallback, useEffect, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError, type LibraryStateResponse } from './api/client.ts';
import { CatalogView } from './components/CatalogView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { LoginView } from './components/LoginView.tsx';
import { MembersView } from './components/MembersView.tsx';
import {
  DemoModeModal,
  MemberFormModal,
  ResourceDetailsModal,
  ResourceFormModal,
} from './components/Modals.tsx';
import { MyCirculationView } from './components/MyCirculationView.tsx';
import { ToastContainer, type ToastMessage } from './components/ToastContainer.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';
import {
  type MemberType,
  type ResourceDTO,
  type ResourceInput,
  TransactionStatus,
  UserRole,
} from './domain/index.ts';
import { formatCurrency, formatDate } from './utils/format.ts';

type NavTab = 'dashboard' | 'catalog' | 'my-loans' | 'members' | 'transactions';

export default function App() {
  const [state, setState] = useState<LibraryStateResponse | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceDTO | null>(null);
  const [detailsResource, setDetailsResource] = useState<ResourceDTO | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const pushToast = useCallback(
    (type: ToastMessage['type'], title: string, detail?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshState = useCallback(async () => {
    const data = await api.fetchState();
    setState(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const session = await api.checkSession();
        if (session.authenticated) {
          const data = await api.fetchState();
          if (mounted) setState(data);
        } else if (mounted) {
          setState(null);
        }
      } catch {
        if (mounted) setState(null);
      } finally {
        if (mounted) setBootstrapping(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    await api.login(email, password);
    const data = await api.fetchState();
    setState(data);
    setActiveTab('dashboard');
    pushToast('success', `Signed in as ${data.user.name}`);
  };

  const handleLogout = async () => {
    await api.logout();
    setState(null);
    setActiveTab('dashboard');
    setMobileMenuOpen(false);
  };

  const handleBorrow = async (resourceId: string) => {
    setBusyId(resourceId);
    try {
      const res = await api.borrowResource(resourceId);
      await refreshState();
      pushToast(
        'success',
        `Borrowed "${res.resource.title}"`,
        `Due back by ${new Date(res.transaction.dueDate).toLocaleDateString('en-IN')}`
      );
    } catch (err) {
      pushToast(
        'error',
        'Cannot borrow resource',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async (resourceId: string) => {
    setBusyId(resourceId);
    try {
      const res = await api.returnResource(resourceId);
      await refreshState();
      if (res.fineAmount > 0 && res.heldForMemberName) {
        pushToast(
          'info',
          `Returned "${res.resource.title}" (${res.daysOverdue}d overdue)`,
          `Fine ${formatCurrency(res.fineAmount)} assessed. Held for ${res.heldForMemberName}.`
        );
      } else if (res.fineAmount > 0) {
        pushToast(
          'info',
          `Returned "${res.resource.title}" (${res.daysOverdue}d overdue)`,
          `Overdue fine of ${formatCurrency(res.fineAmount)} recorded.`
        );
      } else if (res.heldForMemberName) {
        pushToast(
          'success',
          `Returned "${res.resource.title}"`,
          `Item is now held in reservation queue for ${res.heldForMemberName}.`
        );
      } else {
        pushToast('success', `Returned "${res.resource.title}"`, 'No overdue fine.');
      }
    } catch (err) {
      pushToast(
        'error',
        'Return failed',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReserve = async (resourceId: string) => {
    setBusyId(resourceId);
    try {
      const res = await api.reserveResource(resourceId);
      await refreshState();
      pushToast(
        'success',
        `Reserved "${res.resource.title}"`,
        `Your queue position is #${res.reservation.queuePosition}.`
      );
    } catch (err) {
      pushToast(
        'error',
        'Reservation failed',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    setBusyId(reservationId);
    try {
      const res = await api.cancelReservation(reservationId);
      await refreshState();
      pushToast('info', `Cancelled reservation for "${res.resource.title}"`);
    } catch (err) {
      pushToast(
        'error',
        'Unable to cancel reservation',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handlePayFine = async (memberId?: string) => {
    setBusyId(memberId ?? 'pay-fine');
    try {
      const res = await api.payFine(memberId);
      await refreshState();
      pushToast(
        'success',
        `Settled ${formatCurrency(res.amountPaid)}`,
        `Fine balance cleared for ${res.member.name}.`
      );
    } catch (err) {
      pushToast(
        'error',
        'Payment failed',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveResource = async (input: ResourceInput, existingId?: string) => {
    if (existingId) {
      const res = await api.updateResource(existingId, input);
      await refreshState();
      pushToast('success', `Updated "${res.resource.title}"`);
    } else {
      const res = await api.createResource(input);
      await refreshState();
      pushToast('success', `Added "${res.resource.title}" to catalog`);
    }
  };

  const handleDeleteResource = async (resource: ResourceDTO) => {
    setBusyId(resource.id);
    try {
      await api.deleteResource(resource.id);
      await refreshState();
      pushToast('info', `Deleted "${resource.title}"`);
    } catch (err) {
      pushToast(
        'error',
        'Delete blocked',
        err instanceof ApiError ? err.message : 'Operation failed.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateMember = async (input: {
    name: string;
    email: string;
    password: string;
    memberType: MemberType;
    department: string;
    studentOrStaffId: string;
  }) => {
    const res = await api.createMember(input);
    await refreshState();
    pushToast('success', `Registered ${res.member.name}`);
  };

  const handleAdvanceDemoDays = async (days: number) => {
    const res = await api.advanceDemoDays(days);
    await refreshState();
    pushToast(
      'info',
      `Simulated clock advanced +${days} ${days === 1 ? 'day' : 'days'}`,
      `Effective library date is ${formatDate(res.effectiveDate)} (+${res.simulatedOffsetDays}d offset).`
    );
  };

  const handleResetDemoDate = async () => {
    await api.resetDemoDate();
    await refreshState();
    pushToast(
      'success',
      'Simulated clock reset to today',
      'Effective library date restored to live system time.'
    );
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm font-medium text-slate-600">
          Loading College Library Management System...
        </p>
      </div>
    );
  }

  if (!state) {
    return (
      <>
        <LoginView onLogin={handleLogin} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const { user, stats, resources, members, transactions, reservations } = state;
  const isLibrarian = user.role === UserRole.LIBRARIAN;

  const navItems: Array<{ id: NavTab; label: string; Icon: typeof LayoutDashboard }> =
    isLibrarian
      ? [
          { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
          { id: 'catalog', label: 'Catalog', Icon: Library },
          { id: 'transactions', label: 'Transactions & Fines', Icon: ClipboardList },
          { id: 'members', label: 'Members', Icon: Users },
        ]
      : [
          { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
          { id: 'catalog', label: 'Browse Catalog', Icon: Library },
          { id: 'my-loans', label: 'My Loans & Queue', Icon: BookMarked },
        ];

  const pageTitleMap: Record<NavTab, string> = {
    dashboard: 'Dashboard',
    catalog: 'Library Catalog',
    'my-loans': 'My Loans & Reservations',
    members: 'Registered Members',
    transactions: 'Circulation Ledger & Overdue Fines',
  };

  const selectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900 text-white shrink-0">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-slate-900 truncate">
            College Library
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-950'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-blue-900' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">
              {isLibrarian
                ? `Librarian · ${user.studentOrStaffId}`
                : `${user.memberType === 'FACULTY' ? 'Faculty' : 'Student'} · ${user.department}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-64 max-w-xs flex-col bg-white border-r border-slate-200 z-10">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-display text-sm font-bold text-slate-900">
                College Library
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="flex-1 p-3 space-y-1">
              {navItems.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-blue-50 text-blue-950'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                {pageTitleMap[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                state.simulatedOffsetDays > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {state.simulatedOffsetDays > 0
                  ? `Demo Mode (+${state.simulatedOffsetDays}d)`
                  : 'Demo Mode'}
              </span>
            </button>
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
              {user.name} ·{' '}
              {isLibrarian
                ? 'Librarian'
                : `${user.memberType === 'FACULTY' ? 'Faculty' : 'Student'} (${
                    user.activeBorrowCount
                  }/${user.borrowLimit})`}
            </span>
            {isLibrarian && activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => {
                  setEditingResource(null);
                  setResourceModalOpen(true);
                }}
                className="rounded-lg bg-blue-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                Add Resource
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              stats={stats}
              resources={resources}
              transactions={transactions}
              reservations={reservations}
              onNavigate={(tab) => selectTab(tab as NavTab)}
              onReturnResource={handleReturn}
              onPayFine={handlePayFine}
              busyId={busyId}
              effectiveDate={state.effectiveDate}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogView
              user={user}
              resources={resources}
              onAddResource={() => {
                setEditingResource(null);
                setResourceModalOpen(true);
              }}
              onEditResource={(res) => {
                setEditingResource(res);
                setResourceModalOpen(true);
              }}
              onDeleteResource={handleDeleteResource}
              onViewDetails={(res) => setDetailsResource(res)}
              onBorrow={handleBorrow}
              onReturn={handleReturn}
              onReserve={handleReserve}
              busyId={busyId}
            />
          )}

          {activeTab === 'my-loans' && !isLibrarian && (
            <MyCirculationView
              user={user}
              resources={resources}
              transactions={transactions}
              reservations={reservations}
              onReturn={handleReturn}
              onBorrow={handleBorrow}
              onCancelReservation={handleCancelReservation}
              onPayFine={() => handlePayFine()}
              busyId={busyId}
              effectiveDate={state.effectiveDate}
            />
          )}

          {activeTab === 'members' && isLibrarian && (
            <MembersView
              members={members}
              onAddMember={() => setMemberModalOpen(true)}
              onCollectFine={(id) => handlePayFine(id)}
              busyId={busyId}
            />
          )}

          {activeTab === 'transactions' && isLibrarian && (
            <TransactionsView
              resources={resources}
              transactions={transactions}
              reservations={reservations}
              onReturn={handleReturn}
              onCancelReservation={handleCancelReservation}
              busyId={busyId}
              effectiveDate={state.effectiveDate}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <ResourceFormModal
        open={resourceModalOpen}
        editingResource={editingResource}
        onClose={() => setResourceModalOpen(false)}
        onSave={handleSaveResource}
      />

      <ResourceDetailsModal
        resource={detailsResource}
        onClose={() => setDetailsResource(null)}
      />

      <MemberFormModal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleCreateMember}
      />

      <DemoModeModal
        open={demoModalOpen}
        simulatedOffsetDays={state.simulatedOffsetDays}
        effectiveDate={state.effectiveDate}
        activeCount={
          transactions.filter(
            (t) =>
              t.status === TransactionStatus.ACTIVE ||
              t.status === TransactionStatus.OVERDUE
          ).length
        }
        overdueCount={
          transactions.filter((t) => t.status === TransactionStatus.OVERDUE).length
        }
        onClose={() => setDemoModalOpen(false)}
        onAdvanceDays={handleAdvanceDemoDays}
        onReset={handleResetDemoDate}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
