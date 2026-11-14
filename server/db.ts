import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  type LibrarySnapshot,
  type MemberDTO,
  MemberType,
  type ReservationDTO,
  ReservationStatus,
  type ResourceDTO,
  ResourceStatus,
  ResourceType,
  type TransactionDTO,
  TransactionStatus,
  UserRole,
} from '../src/domain/index.ts';

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data', 'library.db');
const DATA_DIR = path.dirname(DB_PATH);

export interface UserRecord extends MemberDTO {
  passwordHash: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      member_type TEXT,
      department TEXT NOT NULL,
      student_or_staff_id TEXT NOT NULL,
      borrow_limit INTEGER NOT NULL DEFAULT 0,
      active_borrow_count INTEGER NOT NULL DEFAULT 0,
      unpaid_fines REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      author_or_publisher TEXT NOT NULL,
      year INTEGER NOT NULL,
      call_number TEXT NOT NULL,
      status TEXT NOT NULL,
      current_borrower_id TEXT,
      due_date TEXT,
      held_for_member_id TEXT,
      reservation_queue TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      resource_title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      borrow_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      fine_amount REAL NOT NULL DEFAULT 0,
      fine_paid INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      resource_title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      reserved_at TEXT NOT NULL,
      queue_position INTEGER NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  dbInstance = db;
  seedIfEmpty(db);
  return db;
}

export function getSimulatedOffsetDays(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = 'simulated_offset_days'")
    .get() as { value: string } | undefined;
  const parsed = row ? Number(row.value) : 0;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function setSimulatedOffsetDays(db: DatabaseSync, days: number): number {
  const cleanDays = Math.max(0, Math.min(3650, Math.floor(days)));
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES ('simulated_offset_days', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(cleanDays));
  return cleanDays;
}

export function getEffectiveDate(offsetDays: number): Date {
  const d = new Date();
  if (offsetDays > 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return d;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function seedIfEmpty(db: DatabaseSync): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const nowIso = new Date().toISOString();

  // Seed 1 Librarian + 5 Members (Students & Faculty)
  const users: UserRecord[] = [
    {
      id: 'usr-librarian-1',
      name: 'Dr. Kavita Rao',
      email: 'librarian@college.edu',
      passwordHash: hashPassword('Admin@123'),
      role: UserRole.LIBRARIAN,
      department: 'Central Library',
      studentOrStaffId: 'LIB-001',
      borrowLimit: 0,
      activeBorrowCount: 0,
      unpaidFines: 0,
      createdAt: nowIso,
    },
    {
      id: 'usr-mem-1',
      name: 'Aarav Sharma',
      email: 'aarav@college.edu',
      passwordHash: hashPassword('Pass@123'),
      role: UserRole.MEMBER,
      memberType: MemberType.STUDENT,
      department: 'Computer Science',
      studentOrStaffId: 'STU-2026-014',
      borrowLimit: 3,
      activeBorrowCount: 2,
      unpaidFines: 0,
      createdAt: nowIso,
    },
    {
      id: 'usr-mem-2',
      name: 'Dr. Priya Nair',
      email: 'priya@college.edu',
      passwordHash: hashPassword('Pass@123'),
      role: UserRole.MEMBER,
      memberType: MemberType.FACULTY,
      department: 'Electronics & Comm.',
      studentOrStaffId: 'FAC-2019-008',
      borrowLimit: 5,
      activeBorrowCount: 1,
      unpaidFines: 0,
      createdAt: nowIso,
    },
    {
      id: 'usr-mem-3',
      name: 'Rohan Verma',
      email: 'rohan@college.edu',
      passwordHash: hashPassword('Pass@123'),
      role: UserRole.MEMBER,
      memberType: MemberType.STUDENT,
      department: 'Mechanical Engg.',
      studentOrStaffId: 'STU-2025-089',
      borrowLimit: 3,
      activeBorrowCount: 1,
      unpaidFines: 14,
      createdAt: nowIso,
    },
    {
      id: 'usr-mem-4',
      name: 'Dr. Meera Krishnan',
      email: 'meera@college.edu',
      passwordHash: hashPassword('Pass@123'),
      role: UserRole.MEMBER,
      memberType: MemberType.FACULTY,
      department: 'Mathematics',
      studentOrStaffId: 'FAC-2017-003',
      borrowLimit: 5,
      activeBorrowCount: 0,
      unpaidFines: 0,
      createdAt: nowIso,
    },
    {
      id: 'usr-mem-5',
      name: 'Ananya Iyer',
      email: 'ananya@college.edu',
      passwordHash: hashPassword('Pass@123'),
      role: UserRole.MEMBER,
      memberType: MemberType.STUDENT,
      department: 'Biotechnology',
      studentOrStaffId: 'STU-2026-042',
      borrowLimit: 3,
      activeBorrowCount: 1,
      unpaidFines: 0,
      createdAt: nowIso,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, member_type, department, student_or_staff_id, borrow_limit, active_borrow_count, unpaid_fines, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(
      u.id,
      u.name,
      u.email,
      u.passwordHash,
      u.role,
      u.memberType ?? null,
      u.department,
      u.studentOrStaffId,
      u.borrowLimit,
      u.activeBorrowCount,
      u.unpaidFines,
      u.createdAt
    );
  }

  // Seed 18 Resources across Books (6), Journals (4), Magazines (4), Digital (4)
  const resources: ResourceDTO[] = [
    // Books (6)
    {
      id: 'res-book-1',
      type: ResourceType.BOOK,
      title: 'Introduction to Algorithms',
      authorOrPublisher: 'Thomas H. Cormen et al.',
      year: 2022,
      callNumber: 'QA76.6.I58',
      status: ResourceStatus.BORROWED,
      currentBorrowerId: 'usr-mem-1',
      dueDate: daysFromNow(9),
      heldForMemberId: null,
      reservationQueue: [],
      isbn: '978-0262046305',
      genre: 'Algorithms',
      pages: 1312,
    },
    {
      id: 'res-book-2',
      type: ResourceType.BOOK,
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      authorOrPublisher: 'Robert C. Martin',
      year: 2008,
      callNumber: 'QA76.76.C54',
      status: ResourceStatus.OVERDUE,
      currentBorrowerId: 'usr-mem-1',
      dueDate: daysFromNow(-5),
      heldForMemberId: null,
      reservationQueue: ['usr-mem-4'],
      isbn: '978-0132350884',
      genre: 'Software Engineering',
      pages: 464,
    },
    {
      id: 'res-book-3',
      type: ResourceType.BOOK,
      title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
      authorOrPublisher: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
      year: 1994,
      callNumber: 'QA76.64.D47',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      isbn: '978-0201633610',
      genre: 'Object-Oriented Design',
      pages: 395,
    },
    {
      id: 'res-book-4',
      type: ResourceType.BOOK,
      title: 'Operating System Concepts',
      authorOrPublisher: 'Abraham Silberschatz',
      year: 2018,
      callNumber: 'QA76.76.O63',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      isbn: '978-1119456339',
      genre: 'Systems',
      pages: 976,
    },
    {
      id: 'res-book-5',
      type: ResourceType.BOOK,
      title: 'Database System Concepts',
      authorOrPublisher: 'Henry F. Korth & Avi Silberschatz',
      year: 2020,
      callNumber: 'QA76.9.D3',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      isbn: '978-0078022159',
      genre: 'Databases',
      pages: 1376,
    },
    {
      id: 'res-book-6',
      type: ResourceType.BOOK,
      title: 'Linear Algebra and Its Applications',
      authorOrPublisher: 'Gilbert Strang',
      year: 2016,
      callNumber: 'QA184.2.S77',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      isbn: '978-0980232776',
      genre: 'Mathematics',
      pages: 574,
    },
    // Journals (4)
    {
      id: 'res-jrn-1',
      type: ResourceType.JOURNAL,
      title: 'IEEE Transactions on Software Engineering',
      authorOrPublisher: 'IEEE Computer Society',
      year: 2025,
      callNumber: 'PER-QA76-IEEE',
      status: ResourceStatus.BORROWED,
      currentBorrowerId: 'usr-mem-2',
      dueDate: daysFromNow(4),
      heldForMemberId: null,
      reservationQueue: ['usr-mem-5'],
      issn: '0098-5589',
      volume: 51,
      issue: 4,
      peerReviewed: true,
    },
    {
      id: 'res-jrn-2',
      type: ResourceType.JOURNAL,
      title: 'ACM Computing Surveys',
      authorOrPublisher: 'Association for Computing Machinery',
      year: 2025,
      callNumber: 'PER-QA76-ACM',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issn: '0360-0300',
      volume: 57,
      issue: 9,
      peerReviewed: true,
    },
    {
      id: 'res-jrn-3',
      type: ResourceType.JOURNAL,
      title: 'Nature Machine Intelligence',
      authorOrPublisher: 'Springer Nature',
      year: 2026,
      callNumber: 'PER-Q335-NAT',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issn: '2522-5839',
      volume: 8,
      issue: 2,
      peerReviewed: true,
    },
    {
      id: 'res-jrn-4',
      type: ResourceType.JOURNAL,
      title: 'Journal of Mechanical Design',
      authorOrPublisher: 'ASME Press',
      year: 2025,
      callNumber: 'PER-TJ230-ASME',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issn: '1050-0472',
      volume: 147,
      issue: 6,
      peerReviewed: true,
    },
    // Magazines (4)
    {
      id: 'res-mag-1',
      type: ResourceType.MAGAZINE,
      title: 'MIT Technology Review',
      authorOrPublisher: 'MIT Press',
      year: 2026,
      callNumber: 'MAG-T1-MIT',
      status: ResourceStatus.BORROWED,
      currentBorrowerId: 'usr-mem-3',
      dueDate: daysFromNow(2),
      heldForMemberId: null,
      reservationQueue: [],
      issueNumber: 'Vol. 129 No. 2',
      frequency: 'Bimonthly',
      category: 'Emerging Tech',
    },
    {
      id: 'res-mag-2',
      type: ResourceType.MAGAZINE,
      title: 'IEEE Spectrum',
      authorOrPublisher: 'IEEE Publishing',
      year: 2026,
      callNumber: 'MAG-TK1-SPEC',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issueNumber: 'Mar 2026',
      frequency: 'Monthly',
      category: 'Engineering',
    },
    {
      id: 'res-mag-3',
      type: ResourceType.MAGAZINE,
      title: 'Scientific American',
      authorOrPublisher: 'Springer Nature',
      year: 2026,
      callNumber: 'MAG-Q1-SCIAM',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issueNumber: 'Issue 334',
      frequency: 'Monthly',
      category: 'General Science',
    },
    {
      id: 'res-mag-4',
      type: ResourceType.MAGAZINE,
      title: 'Communications of the ACM',
      authorOrPublisher: 'ACM Media',
      year: 2026,
      callNumber: 'MAG-QA76-CACM',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      issueNumber: 'Vol. 69 No. 4',
      frequency: 'Monthly',
      category: 'Computing',
    },
    // Digital Resources (4)
    {
      id: 'res-dig-1',
      type: ResourceType.DIGITAL,
      title: 'Distributed Systems Lecture Pack',
      authorOrPublisher: 'MIT OpenCourseWare',
      year: 2025,
      callNumber: 'DIG-CS-6824',
      status: ResourceStatus.BORROWED,
      currentBorrowerId: 'usr-mem-5',
      dueDate: daysFromNow(2),
      heldForMemberId: null,
      reservationQueue: [],
      fileFormat: 'PDF',
      fileSizeMb: 24.8,
      accessUrl: 'https://library.college.edu/digital/distributed-systems-6824.pdf',
    },
    {
      id: 'res-dig-2',
      type: ResourceType.DIGITAL,
      title: 'Compiler Construction & LLVM Architecture Guide',
      authorOrPublisher: 'Stanford CS Archive',
      year: 2025,
      callNumber: 'DIG-CS-143',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      fileFormat: 'EPUB',
      fileSizeMb: 12.4,
      accessUrl: 'https://library.college.edu/digital/compiler-llvm-guide.epub',
    },
    {
      id: 'res-dig-3',
      type: ResourceType.DIGITAL,
      title: 'Applied Cryptography Digital Monograph',
      authorOrPublisher: 'Bruce Schneier',
      year: 2024,
      callNumber: 'DIG-SEC-401',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      fileFormat: 'PDF',
      fileSizeMb: 19.2,
      accessUrl: 'https://library.college.edu/digital/applied-cryptography.pdf',
    },
    {
      id: 'res-dig-4',
      type: ResourceType.DIGITAL,
      title: 'Biomedical Signal Processing Lab Manual',
      authorOrPublisher: 'NPTEL Digital Repository',
      year: 2025,
      callNumber: 'DIG-BIO-310',
      status: ResourceStatus.AVAILABLE,
      currentBorrowerId: null,
      dueDate: null,
      heldForMemberId: null,
      reservationQueue: [],
      fileFormat: 'PDF',
      fileSizeMb: 31.6,
      accessUrl: 'https://library.college.edu/digital/biomedical-signals.pdf',
    },
  ];

  const insertResource = db.prepare(`
    INSERT INTO resources (id, type, title, author_or_publisher, year, call_number, status, current_borrower_id, due_date, held_for_member_id, reservation_queue, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of resources) {
    const metadata: Record<string, unknown> = {};
    if (r.type === ResourceType.BOOK) {
      metadata.isbn = r.isbn;
      metadata.genre = r.genre;
      metadata.pages = r.pages;
    } else if (r.type === ResourceType.JOURNAL) {
      metadata.issn = r.issn;
      metadata.volume = r.volume;
      metadata.issue = r.issue;
      metadata.peerReviewed = r.peerReviewed;
    } else if (r.type === ResourceType.MAGAZINE) {
      metadata.issueNumber = r.issueNumber;
      metadata.frequency = r.frequency;
      metadata.category = r.category;
    } else if (r.type === ResourceType.DIGITAL) {
      metadata.fileFormat = r.fileFormat;
      metadata.fileSizeMb = r.fileSizeMb;
      metadata.accessUrl = r.accessUrl;
    }

    insertResource.run(
      r.id,
      r.type,
      r.title,
      r.authorOrPublisher,
      r.year,
      r.callNumber,
      r.status,
      r.currentBorrowerId,
      r.dueDate,
      r.heldForMemberId,
      JSON.stringify(r.reservationQueue),
      JSON.stringify(metadata)
    );
  }

  // Seed Transactions (active, overdue, unpaid fine, and historical paid fine)
  const transactions: TransactionDTO[] = [
    {
      id: 'tx-seed-1',
      resourceId: 'res-book-1',
      resourceTitle: 'Introduction to Algorithms',
      resourceType: ResourceType.BOOK,
      memberId: 'usr-mem-1',
      memberName: 'Aarav Sharma',
      borrowDate: daysFromNow(-5),
      dueDate: daysFromNow(9),
      returnDate: null,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.ACTIVE,
    },
    {
      id: 'tx-seed-2',
      resourceId: 'res-book-2',
      resourceTitle: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      resourceType: ResourceType.BOOK,
      memberId: 'usr-mem-1',
      memberName: 'Aarav Sharma',
      borrowDate: daysFromNow(-19),
      dueDate: daysFromNow(-5),
      returnDate: null,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.OVERDUE,
    },
    {
      id: 'tx-seed-3',
      resourceId: 'res-jrn-1',
      resourceTitle: 'IEEE Transactions on Software Engineering',
      resourceType: ResourceType.JOURNAL,
      memberId: 'usr-mem-2',
      memberName: 'Dr. Priya Nair',
      borrowDate: daysFromNow(-3),
      dueDate: daysFromNow(4),
      returnDate: null,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.ACTIVE,
    },
    {
      id: 'tx-seed-4',
      resourceId: 'res-mag-1',
      resourceTitle: 'MIT Technology Review',
      resourceType: ResourceType.MAGAZINE,
      memberId: 'usr-mem-3',
      memberName: 'Rohan Verma',
      borrowDate: daysFromNow(-3),
      dueDate: daysFromNow(2),
      returnDate: null,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.ACTIVE,
    },
    {
      id: 'tx-seed-5',
      resourceId: 'res-dig-1',
      resourceTitle: 'Distributed Systems Lecture Pack',
      resourceType: ResourceType.DIGITAL,
      memberId: 'usr-mem-5',
      memberName: 'Ananya Iyer',
      borrowDate: daysFromNow(-1),
      dueDate: daysFromNow(2),
      returnDate: null,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.ACTIVE,
    },
    {
      id: 'tx-seed-6',
      resourceId: 'res-jrn-2',
      resourceTitle: 'ACM Computing Surveys',
      resourceType: ResourceType.JOURNAL,
      memberId: 'usr-mem-3',
      memberName: 'Rohan Verma',
      borrowDate: daysFromNow(-14),
      dueDate: daysFromNow(-7),
      returnDate: daysFromNow(-4),
      fineAmount: 14,
      finePaid: false,
      status: TransactionStatus.RETURNED,
    },
    {
      id: 'tx-seed-7',
      resourceId: 'res-book-3',
      resourceTitle: 'Design Patterns: Elements of Reusable Object-Oriented Software',
      resourceType: ResourceType.BOOK,
      memberId: 'usr-mem-4',
      memberName: 'Dr. Meera Krishnan',
      borrowDate: daysFromNow(-30),
      dueDate: daysFromNow(-16),
      returnDate: daysFromNow(-11),
      fineAmount: 10,
      finePaid: true,
      status: TransactionStatus.RETURNED,
    },
  ];

  const insertTx = db.prepare(`
    INSERT INTO transactions (id, resource_id, resource_title, resource_type, member_id, member_name, borrow_date, due_date, return_date, fine_amount, fine_paid, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of transactions) {
    insertTx.run(
      t.id,
      t.resourceId,
      t.resourceTitle,
      t.resourceType,
      t.memberId,
      t.memberName,
      t.borrowDate,
      t.dueDate,
      t.returnDate,
      t.fineAmount,
      t.finePaid ? 1 : 0,
      t.status
    );
  }

  // Seed Reservations
  const reservations: ReservationDTO[] = [
    {
      id: 'resv-seed-1',
      resourceId: 'res-book-2',
      resourceTitle: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      resourceType: ResourceType.BOOK,
      memberId: 'usr-mem-4',
      memberName: 'Dr. Meera Krishnan',
      reservedAt: daysFromNow(-2),
      queuePosition: 1,
      status: ReservationStatus.WAITING,
    },
    {
      id: 'resv-seed-2',
      resourceId: 'res-jrn-1',
      resourceTitle: 'IEEE Transactions on Software Engineering',
      resourceType: ResourceType.JOURNAL,
      memberId: 'usr-mem-5',
      memberName: 'Ananya Iyer',
      reservedAt: daysFromNow(-1),
      queuePosition: 1,
      status: ReservationStatus.WAITING,
    },
  ];

  const insertRes = db.prepare(`
    INSERT INTO reservations (id, resource_id, resource_title, resource_type, member_id, member_name, reserved_at, queue_position, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const res of reservations) {
    insertRes.run(
      res.id,
      res.resourceId,
      res.resourceTitle,
      res.resourceType,
      res.memberId,
      res.memberName,
      res.reservedAt,
      res.queuePosition,
      res.status
    );
  }
}

export function loadSnapshot(db: DatabaseSync): LibrarySnapshot {
  const userRows = db.prepare('SELECT * FROM users').all() as Array<Record<string, unknown>>;
  const resourceRows = db.prepare('SELECT * FROM resources').all() as Array<Record<string, unknown>>;
  const txRows = db.prepare('SELECT * FROM transactions').all() as Array<Record<string, unknown>>;
  const resRows = db.prepare('SELECT * FROM reservations').all() as Array<Record<string, unknown>>;

  const users: MemberDTO[] = userRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role) as UserRole,
    memberType: row.member_type ? (String(row.member_type) as MemberType) : undefined,
    department: String(row.department),
    studentOrStaffId: String(row.student_or_staff_id),
    borrowLimit: Number(row.borrow_limit),
    activeBorrowCount: Number(row.active_borrow_count),
    unpaidFines: Number(row.unpaid_fines),
    createdAt: String(row.created_at),
  }));

  const resources: ResourceDTO[] = resourceRows.map((row) => {
    const meta = JSON.parse(String(row.metadata || '{}')) as Record<string, unknown>;
    return {
      id: String(row.id),
      type: String(row.type) as ResourceType,
      title: String(row.title),
      authorOrPublisher: String(row.author_or_publisher),
      year: Number(row.year),
      callNumber: String(row.call_number),
      status: String(row.status) as ResourceStatus,
      currentBorrowerId: row.current_borrower_id ? String(row.current_borrower_id) : null,
      dueDate: row.due_date ? String(row.due_date) : null,
      heldForMemberId: row.held_for_member_id ? String(row.held_for_member_id) : null,
      reservationQueue: JSON.parse(String(row.reservation_queue || '[]')) as string[],
      isbn: meta.isbn as string | undefined,
      genre: meta.genre as string | undefined,
      pages: meta.pages as number | undefined,
      issn: meta.issn as string | undefined,
      volume: meta.volume as number | undefined,
      issue: meta.issue as number | undefined,
      peerReviewed: meta.peerReviewed as boolean | undefined,
      issueNumber: meta.issueNumber as string | undefined,
      frequency: meta.frequency as string | undefined,
      category: meta.category as string | undefined,
      fileFormat: meta.fileFormat as string | undefined,
      fileSizeMb: meta.fileSizeMb as number | undefined,
      accessUrl: meta.accessUrl as string | undefined,
    };
  });

  const transactions: TransactionDTO[] = txRows.map((row) => ({
    id: String(row.id),
    resourceId: String(row.resource_id),
    resourceTitle: String(row.resource_title),
    resourceType: String(row.resource_type) as ResourceType,
    memberId: String(row.member_id),
    memberName: String(row.member_name),
    borrowDate: String(row.borrow_date),
    dueDate: String(row.due_date),
    returnDate: row.return_date ? String(row.return_date) : null,
    fineAmount: Number(row.fine_amount),
    finePaid: Boolean(row.fine_paid),
    status: String(row.status) as TransactionStatus,
  }));

  const reservations: ReservationDTO[] = resRows.map((row) => ({
    id: String(row.id),
    resourceId: String(row.resource_id),
    resourceTitle: String(row.resource_title),
    resourceType: String(row.resource_type) as ResourceType,
    memberId: String(row.member_id),
    memberName: String(row.member_name),
    reservedAt: String(row.reserved_at),
    queuePosition: Number(row.queue_position),
    status: String(row.status) as ReservationStatus,
  }));

  return { users, resources, transactions, reservations };
}

export function saveSnapshot(
  db: DatabaseSync,
  snapshot: LibrarySnapshot,
  passwordMap?: Map<string, string>
): void {
  db.exec('BEGIN IMMEDIATE;');
  try {
    // Sync resources
    db.exec('DELETE FROM resources;');
    const insertResource = db.prepare(`
      INSERT INTO resources (id, type, title, author_or_publisher, year, call_number, status, current_borrower_id, due_date, held_for_member_id, reservation_queue, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of snapshot.resources) {
      const metadata: Record<string, unknown> = {};
      if (r.type === ResourceType.BOOK) {
        metadata.isbn = r.isbn;
        metadata.genre = r.genre;
        metadata.pages = r.pages;
      } else if (r.type === ResourceType.JOURNAL) {
        metadata.issn = r.issn;
        metadata.volume = r.volume;
        metadata.issue = r.issue;
        metadata.peerReviewed = r.peerReviewed;
      } else if (r.type === ResourceType.MAGAZINE) {
        metadata.issueNumber = r.issueNumber;
        metadata.frequency = r.frequency;
        metadata.category = r.category;
      } else if (r.type === ResourceType.DIGITAL) {
        metadata.fileFormat = r.fileFormat;
        metadata.fileSizeMb = r.fileSizeMb;
        metadata.accessUrl = r.accessUrl;
      }
      insertResource.run(
        r.id,
        r.type,
        r.title,
        r.authorOrPublisher,
        r.year,
        r.callNumber,
        r.status,
        r.currentBorrowerId,
        r.dueDate,
        r.heldForMemberId,
        JSON.stringify(r.reservationQueue),
        JSON.stringify(metadata)
      );
    }

    // Update existing users' counters or insert newly registered members
    const existingHashes = new Map<string, string>();
    const existingRows = db
      .prepare('SELECT id, password_hash FROM users')
      .all() as Array<{ id: string; password_hash: string }>;
    for (const row of existingRows) {
      existingHashes.set(row.id, row.password_hash);
    }

    const upsertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, member_type, department, student_or_staff_id, borrow_limit, active_borrow_count, unpaid_fines, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        department = excluded.department,
        student_or_staff_id = excluded.student_or_staff_id,
        borrow_limit = excluded.borrow_limit,
        active_borrow_count = excluded.active_borrow_count,
        unpaid_fines = excluded.unpaid_fines
    `);

    for (const u of snapshot.users) {
      const pwHash =
        passwordMap?.get(u.id) ?? existingHashes.get(u.id) ?? hashPassword('Pass@123');
      upsertUser.run(
        u.id,
        u.name,
        u.email,
        pwHash,
        u.role,
        u.memberType ?? null,
        u.department,
        u.studentOrStaffId,
        u.borrowLimit,
        u.activeBorrowCount,
        u.unpaidFines,
        u.createdAt
      );
    }

    // Sync transactions
    db.exec('DELETE FROM transactions;');
    const insertTx = db.prepare(`
      INSERT INTO transactions (id, resource_id, resource_title, resource_type, member_id, member_name, borrow_date, due_date, return_date, fine_amount, fine_paid, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of snapshot.transactions) {
      insertTx.run(
        t.id,
        t.resourceId,
        t.resourceTitle,
        t.resourceType,
        t.memberId,
        t.memberName,
        t.borrowDate,
        t.dueDate,
        t.returnDate,
        t.fineAmount,
        t.finePaid ? 1 : 0,
        t.status
      );
    }

    // Sync reservations
    db.exec('DELETE FROM reservations;');
    const insertRes = db.prepare(`
      INSERT INTO reservations (id, resource_id, resource_title, resource_type, member_id, member_name, reserved_at, queue_position, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const res of snapshot.reservations) {
      insertRes.run(
        res.id,
        res.resourceId,
        res.resourceTitle,
        res.resourceType,
        res.memberId,
        res.memberName,
        res.reservedAt,
        res.queuePosition,
        res.status
      );
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
