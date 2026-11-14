import { useState, type FormEvent } from 'react';
import { BookOpen, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { ApiError } from '../api/client.ts';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Librarian (Admin)',
    name: 'Dr. Kavita Rao',
    email: 'librarian@college.edu',
    pass: 'Admin@123',
    note: 'Full catalog, member & ledger control',
  },
  {
    label: 'Student Member',
    name: 'Aarav Sharma',
    email: 'aarav@college.edu',
    pass: 'Pass@123',
    note: '3-item limit · 1 overdue book',
  },
  {
    label: 'Faculty Member',
    name: 'Dr. Priya Nair',
    email: 'priya@college.edu',
    pass: 'Pass@123',
    note: '5-item limit · 1 active journal',
  },
  {
    label: 'Student (Fine Due)',
    name: 'Rohan Verma',
    email: 'rohan@college.edu',
    pass: 'Pass@123',
    note: '₹14 unpaid fine · borrow blocked',
  },
];

export function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError('Please enter a valid college email address.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await onLogin(trimmedEmail, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to sign in. Please verify your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applyDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left column: Institutional summary & Demo directory */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7 sm:p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 text-white">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  College Library Management System
                </h1>
                <p className="text-xs text-slate-500">
                  Academic Circulation · Catalog · Reservations
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-slate-600">
              Sign in with your institutional credentials to search holdings across Books,
              Academic Journals, Magazines, and Digital Resources, manage active loans,
              join reservation queues, and settle overdue fines.
            </p>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Polymorphic Circulation Policy
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-900">Books</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-600">
                    14 days · ₹2/day fine
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-900">Journals</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-600">
                    7 days · ₹5/day fine
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-900">Magazines</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-600">
                    5 days · ₹3/day fine
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-900">Digital Resources</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-600">
                    3 days · No fine
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium text-slate-500">
              Student limit: 3 active items · Faculty limit: 5 active items
            </p>
          </div>
        </div>

        {/* Right column: Sign-in form + Quick-fill demo credentials */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Account Sign In
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter your college email and password to access your workspace.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-medium text-slate-700"
                >
                  College Email
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@college.edu"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Seeded Credentials (Click to Fill)
            </p>
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  onClick={() => applyDemoAccount(acct.email, acct.pass)}
                  className="text-left rounded-lg bg-slate-50 px-3 py-2.5 transition-colors hover:bg-blue-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {acct.label}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-blue-800 shrink-0">
                      Fill
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 break-all">
                    {acct.email}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    Password: {acct.pass}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
