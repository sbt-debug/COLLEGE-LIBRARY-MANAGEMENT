import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  DomainValidationError,
  LibraryService,
  type MemberDTO,
  MemberType,
  type ResourceInput,
  requireNonEmptyText,
  requireValidEmail,
  UserRole,
} from './src/domain/index.ts';
import {
  getDb,
  getEffectiveDate,
  getSimulatedOffsetDays,
  hashPassword,
  loadSnapshot,
  saveSnapshot,
  setSimulatedOffsetDays,
  verifyPassword,
} from './server/db.ts';

interface AuthenticatedRequest extends Request {
  authUser?: MemberDTO;
  sessionToken?: string;
}

const SESSION_COOKIE = 'clms_session';
const PORT = Number(process.env.PORT) || 3000;

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k && rest.length > 0) {
      result[k] = decodeURIComponent(rest.join('='));
    }
  }
  return result;
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] ?? null;
}

function formatError(err: unknown): { status: number; message: string; field?: string } {
  if (err instanceof DomainValidationError) {
    return { status: 400, message: err.message, field: err.field };
  }
  if (err instanceof Error) {
    return { status: 500, message: err.message };
  }
  return { status: 500, message: 'An unexpected server error occurred.' };
}

async function createServer() {
  const db = getDb();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  // Healthcheck for cloud hosts (Render, Railway, Cloud Run, Fly.io)
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  // Auth middleware
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const sessionRow = db
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
      .get(token) as { user_id: string; expires_at: string } | undefined;

    if (!sessionRow || new Date(sessionRow.expires_at).getTime() < Date.now()) {
      if (sessionRow) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      }
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    const snapshot = loadSnapshot(db);
    const service = new LibraryService(snapshot);
    const user = service.getUsers().find((u) => u.id === sessionRow.user_id);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    req.authUser = user;
    req.sessionToken = token;
    next();
  };

  const requireLibrarian = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || req.authUser.role !== UserRole.LIBRARIAN) {
      res.status(403).json({ error: 'Access denied. Librarian privileges required.' });
      return;
    }
    next();
  };

  // --- Auth Endpoints ---

  app.post('/api/auth/login', (req, res) => {
    try {
      const email = requireValidEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (password.length < 4) {
        throw new DomainValidationError('Password is required.', 'password');
      }

      const row = db
        .prepare('SELECT id, password_hash FROM users WHERE email = ?')
        .get(email) as { id: string; password_hash: string } | undefined;

      if (!row || !verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(
        'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
      ).run(token, row.id, now.toISOString(), expiresAt);

      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const user = service.getUsers().find((u) => u.id === row.id);

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json({ token, user });
    } catch (err) {
      const { status, message, field } = formatError(err);
      res.status(status).json({ error: message, field });
    }
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const token = getTokenFromRequest(req);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const sessionRow = db
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
      .get(token) as { user_id: string; expires_at: string } | undefined;

    if (!sessionRow || new Date(sessionRow.expires_at).getTime() < Date.now()) {
      res.json({ authenticated: false, user: null });
      return;
    }

    const snapshot = loadSnapshot(db);
    const service = new LibraryService(snapshot);
    const user = service.getUsers().find((u) => u.id === sessionRow.user_id) ?? null;
    res.json({ authenticated: Boolean(user), user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // --- Bootstrap State Endpoint ---

  app.get('/api/library/state', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const offsetDays = getSimulatedOffsetDays(db);
      const effectiveNow = getEffectiveDate(offsetDays);
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const stats = service.getDashboardStats(effectiveNow);
      const resources = service.getResources(effectiveNow);
      const allTransactions = service.getTransactions(effectiveNow);
      const allReservations = service.getReservations();
      const currentUser = service.getUsers().find((u) => u.id === req.authUser!.id)!;

      // Persist any overdue status sync
      saveSnapshot(db, {
        resources,
        users: service.getUsers(),
        transactions: allTransactions,
        reservations: allReservations,
      });

      const isLibrarian = req.authUser!.role === UserRole.LIBRARIAN;
      res.json({
        user: currentUser,
        stats,
        resources,
        members: isLibrarian ? service.getMembers() : [],
        transactions: isLibrarian
          ? allTransactions
          : allTransactions.filter((t) => t.memberId === currentUser.id),
        reservations: isLibrarian
          ? allReservations
          : allReservations.filter((r) => r.memberId === currentUser.id),
        simulatedOffsetDays: offsetDays,
        effectiveDate: effectiveNow.toISOString(),
      });
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/demo/advance-days', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const isReset = Boolean(req.body?.reset);
      const currentOffset = getSimulatedOffsetDays(db);
      let nextOffset = 0;

      if (!isReset) {
        const delta = Number(req.body?.days);
        if (!Number.isInteger(delta) || delta < 1 || delta > 365) {
          throw new DomainValidationError(
            'Days to advance must be a whole number between 1 and 365.',
            'days'
          );
        }
        nextOffset = Math.min(3650, currentOffset + delta);
      }

      const savedOffset = setSimulatedOffsetDays(db, nextOffset);
      const effectiveNow = getEffectiveDate(savedOffset);

      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      service.syncOverdueStates(effectiveNow);
      saveSnapshot(db, {
        resources: service.getResources(effectiveNow),
        users: service.getUsers(),
        transactions: service.getTransactions(effectiveNow),
        reservations: service.getReservations(),
      });

      res.json({
        simulatedOffsetDays: savedOffset,
        effectiveDate: effectiveNow.toISOString(),
      });
    } catch (err) {
      const { status, message, field } = formatError(err);
      res.status(status).json({ error: message, field });
    }
  });

  // --- Catalog CRUD (Librarian Only) ---

  app.post('/api/resources', requireAuth, requireLibrarian, (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const id = `res-${crypto.randomUUID().slice(0, 8)}`;
      const created = service.addResource(id, req.body as ResourceInput, req.authUser!.role);

      saveSnapshot(db, {
        resources: service.getResources(),
        users: service.getUsers(),
        transactions: service.getTransactions(),
        reservations: service.getReservations(),
      });

      res.status(201).json({ resource: created });
    } catch (err) {
      const { status, message, field } = formatError(err);
      res.status(status).json({ error: message, field });
    }
  });

  app.put('/api/resources/:id', requireAuth, requireLibrarian, (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const updated = service.updateResource(
        String(req.params.id),
        req.body as ResourceInput,
        req.authUser!.role
      );

      saveSnapshot(db, {
        resources: service.getResources(),
        users: service.getUsers(),
        transactions: service.getTransactions(),
        reservations: service.getReservations(),
      });

      res.json({ resource: updated });
    } catch (err) {
      const { status, message, field } = formatError(err);
      res.status(status).json({ error: message, field });
    }
  });

  app.delete('/api/resources/:id', requireAuth, requireLibrarian, (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      service.deleteResource(String(req.params.id), req.authUser!.role);

      saveSnapshot(db, {
        resources: service.getResources(),
        users: service.getUsers(),
        transactions: service.getTransactions(),
        reservations: service.getReservations(),
      });

      res.json({ ok: true });
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  // --- Member Management (Librarian Only) ---

  app.post('/api/members', requireAuth, requireLibrarian, (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
      const password = requireNonEmptyText(req.body?.password || 'Pass@123', 'Password', 6, 80);

      const memberType =
        req.body?.memberType === MemberType.FACULTY ? MemberType.FACULTY : MemberType.STUDENT;

      const created = service.addMember(
        {
          id,
          name: req.body?.name,
          email: req.body?.email,
          memberType,
          department: req.body?.department,
          studentOrStaffId: req.body?.studentOrStaffId,
        },
        req.authUser!.role
      );

      const passwordMap = new Map<string, string>();
      passwordMap.set(id, hashPassword(password));

      saveSnapshot(
        db,
        {
          resources: service.getResources(),
          users: service.getUsers(),
          transactions: service.getTransactions(),
          reservations: service.getReservations(),
        },
        passwordMap
      );

      res.status(201).json({ member: created });
    } catch (err) {
      const { status, message, field } = formatError(err);
      res.status(status).json({ error: message, field });
    }
  });

  // --- Circulation Operations (Borrow, Return, Reserve, Cancel, Pay Fine) ---

  app.post('/api/circulation/borrow', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = requireNonEmptyText(req.body?.resourceId, 'Resource ID', 2, 80);
      const targetMemberId =
        req.authUser!.role === UserRole.LIBRARIAN && req.body?.memberId
          ? requireNonEmptyText(req.body.memberId, 'Member ID', 2, 80)
          : req.authUser!.id;

      const effectiveNow = getEffectiveDate(getSimulatedOffsetDays(db));
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const result = service.borrowResource({
        resourceId,
        memberId: targetMemberId,
        transactionId: `tx-${crypto.randomUUID().slice(0, 8)}`,
        borrowDate: effectiveNow,
      });

      saveSnapshot(db, {
        resources: service.getResources(effectiveNow),
        users: service.getUsers(),
        transactions: service.getTransactions(effectiveNow),
        reservations: service.getReservations(),
      });

      res.status(201).json(result);
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/circulation/return', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = requireNonEmptyText(req.body?.resourceId, 'Resource ID', 2, 80);
      const effectiveNow = getEffectiveDate(getSimulatedOffsetDays(db));
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      service.syncOverdueStates(effectiveNow);

      const result = service.returnResource({
        resourceId,
        actorId: req.authUser!.id,
        actorRole: req.authUser!.role,
        returnDate: effectiveNow,
      });

      saveSnapshot(db, {
        resources: service.getResources(effectiveNow),
        users: service.getUsers(),
        transactions: service.getTransactions(effectiveNow),
        reservations: service.getReservations(),
      });

      res.json(result);
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/circulation/reserve', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = requireNonEmptyText(req.body?.resourceId, 'Resource ID', 2, 80);
      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);

      const result = service.reserveResource({
        resourceId,
        memberId: req.authUser!.id,
        reservationId: `resv-${crypto.randomUUID().slice(0, 8)}`,
      });

      saveSnapshot(db, {
        resources: service.getResources(),
        users: service.getUsers(),
        transactions: service.getTransactions(),
        reservations: service.getReservations(),
      });

      res.status(201).json(result);
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post(
    '/api/circulation/reservations/:id/cancel',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      try {
        const snapshot = loadSnapshot(db);
        const service = new LibraryService(snapshot);

        const result = service.cancelReservation({
          reservationId: String(req.params.id),
          actorId: req.authUser!.id,
          actorRole: req.authUser!.role,
        });

        saveSnapshot(db, {
          resources: service.getResources(),
          users: service.getUsers(),
          transactions: service.getTransactions(),
          reservations: service.getReservations(),
        });

        res.json(result);
      } catch (err) {
        const { status, message } = formatError(err);
        res.status(status).json({ error: message });
      }
    }
  );

  app.post('/api/circulation/pay-fine', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const targetMemberId =
        req.authUser!.role === UserRole.LIBRARIAN && req.body?.memberId
          ? requireNonEmptyText(req.body.memberId, 'Member ID', 2, 80)
          : req.authUser!.id;

      const snapshot = loadSnapshot(db);
      const service = new LibraryService(snapshot);
      const result = service.payMemberFines(targetMemberId);

      saveSnapshot(db, {
        resources: service.getResources(),
        users: service.getUsers(),
        transactions: service.getTransactions(),
        reservations: service.getReservations(),
      });

      res.json(result);
    } catch (err) {
      const { status, message } = formatError(err);
      res.status(status).json({ error: message });
    }
  });

  // Return JSON 404 for unknown API routes before SPA HTML fallback
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // --- Vite / Static Frontend Serving ---

  const distDir = path.resolve(process.cwd(), 'dist');
  const isDevCommand = process.env.npm_lifecycle_event === 'dev';
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (!isDevCommand && fs.existsSync(distDir));

  if (isProd) {
    if (!fs.existsSync(distDir)) {
      throw new Error('Production build missing: run "npm run build" before starting in production.');
    }
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `College Library Management System (${isProd ? 'production' : 'development'}) running on http://0.0.0.0:${PORT}`
    );
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
