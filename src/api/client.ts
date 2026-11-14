import type {
  DashboardStatsDTO,
  MemberDTO,
  MemberType,
  ReservationDTO,
  ResourceDTO,
  ResourceInput,
  TransactionDTO,
} from '../domain/index.ts';

const TOKEN_STORAGE_KEY = 'clms_auth_token';

export interface LibraryStateResponse {
  user: MemberDTO;
  stats: DashboardStatsDTO;
  resources: ResourceDTO[];
  members: MemberDTO[];
  transactions: TransactionDTO[];
  reservations: ReservationDTO[];
  simulatedOffsetDays: number;
  effectiveDate: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly field?: string;

  constructor(message: string, status: number, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Request failed.',
      res.status,
      typeof data.field === 'string' ? data.field : undefined
    );
  }
  return data as T;
}

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<{ token: string; user: MemberDTO }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(result.token);
    return result;
  },

  logout: async () => {
    try {
      await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  checkSession: () =>
    request<{ authenticated: boolean; user: MemberDTO | null }>('/api/auth/session'),

  fetchState: () => request<LibraryStateResponse>('/api/library/state'),

  createResource: (input: ResourceInput) =>
    request<{ resource: ResourceDTO }>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateResource: (id: string, input: ResourceInput) =>
    request<{ resource: ResourceDTO }>(`/api/resources/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteResource: (id: string) =>
    request<{ ok: boolean }>(`/api/resources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createMember: (input: {
    name: string;
    email: string;
    password: string;
    memberType: MemberType;
    department: string;
    studentOrStaffId: string;
  }) =>
    request<{ member: MemberDTO }>('/api/members', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  borrowResource: (resourceId: string, memberId?: string) =>
    request<{ transaction: TransactionDTO; resource: ResourceDTO; member: MemberDTO }>(
      '/api/circulation/borrow',
      {
        method: 'POST',
        body: JSON.stringify({ resourceId, memberId }),
      }
    ),

  returnResource: (resourceId: string) =>
    request<{
      transaction: TransactionDTO;
      resource: ResourceDTO;
      member: MemberDTO;
      fineAmount: number;
      daysOverdue: number;
      heldForMemberName: string | null;
    }>('/api/circulation/return', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    }),

  reserveResource: (resourceId: string) =>
    request<{ reservation: ReservationDTO; resource: ResourceDTO }>(
      '/api/circulation/reserve',
      {
        method: 'POST',
        body: JSON.stringify({ resourceId }),
      }
    ),

  cancelReservation: (reservationId: string) =>
    request<{ reservation: ReservationDTO; resource: ResourceDTO }>(
      `/api/circulation/reservations/${encodeURIComponent(reservationId)}/cancel`,
      { method: 'POST' }
    ),

  payFine: (memberId?: string) =>
    request<{ member: MemberDTO; amountPaid: number }>('/api/circulation/pay-fine', {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    }),

  advanceDemoDays: (days: number) =>
    request<{ simulatedOffsetDays: number; effectiveDate: string }>(
      '/api/demo/advance-days',
      {
        method: 'POST',
        body: JSON.stringify({ days }),
      }
    ),

  resetDemoDate: () =>
    request<{ simulatedOffsetDays: number; effectiveDate: string }>(
      '/api/demo/advance-days',
      {
        method: 'POST',
        body: JSON.stringify({ reset: true }),
      }
    ),
};
