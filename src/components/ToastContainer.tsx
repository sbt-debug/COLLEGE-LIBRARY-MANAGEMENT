import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const borderClass = isError
          ? 'border-rose-200 bg-white text-slate-900'
          : isSuccess
            ? 'border-emerald-200 bg-white text-slate-900'
            : 'border-slate-200 bg-white text-slate-900';

        const Icon = isError ? AlertCircle : isSuccess ? CheckCircle2 : Info;
        const iconColor = isError
          ? 'text-rose-600'
          : isSuccess
            ? 'text-emerald-600'
            : 'text-blue-600';

        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-lg border p-3.5 shadow-md ${borderClass}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{toast.title}</p>
              {toast.detail && (
                <p className="mt-0.5 text-xs text-slate-600">{toast.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss notification: ${toast.title}`}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
