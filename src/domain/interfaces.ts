/**
 * Core Domain Interfaces & Enumerated Constants
 * ---------------------------------------------
 * Demonstrates OOP Principle: INTERFACES & CONTRACT DESIGN
 * Defines behavioral contracts (Borrowable, Reservable) that library resources
 * must fulfill regardless of their concrete subclass implementation.
 */

export const ResourceType = {
  BOOK: 'BOOK',
  JOURNAL: 'JOURNAL',
  MAGAZINE: 'MAGAZINE',
  DIGITAL: 'DIGITAL',
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const ResourceStatus = {
  AVAILABLE: 'AVAILABLE',
  BORROWED: 'BORROWED',
  RESERVED: 'RESERVED',
  OVERDUE: 'OVERDUE',
} as const;

export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];

export const MemberType = {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
} as const;

export type MemberType = (typeof MemberType)[keyof typeof MemberType];

export const UserRole = {
  LIBRARIAN: 'LIBRARIAN',
  MEMBER: 'MEMBER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TransactionStatus = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE',
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const ReservationStatus = {
  WAITING: 'WAITING',
  HELD: 'HELD',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export interface BorrowResult {
  dueDate: Date;
  loanPeriodDays: number;
}

export interface ReturnResult {
  daysOverdue: number;
  fineAmount: number;
  nextStatus: ResourceStatus;
}

/**
 * OOP Interface: Borrowable
 * Any library item that can be checked out and returned implements this contract.
 */
export interface Borrowable {
  canBorrow(memberId?: string): boolean;
  borrow(memberId: string, borrowDate?: Date): BorrowResult;
  returnResource(returnDate?: Date, hasPendingReservation?: boolean): ReturnResult;
}

/**
 * OOP Interface: Reservable
 * Any library item supporting a FIFO reservation queue implements this contract.
 */
export interface Reservable {
  canReserve(memberId: string): boolean;
  reserve(memberId: string): void;
  cancelReservation(memberId: string): void;
  hasReservations(): boolean;
  getNextReserver(): string | null;
}

export interface ResourceDTO {
  id: string;
  type: ResourceType;
  title: string;
  authorOrPublisher: string;
  year: number;
  callNumber: string;
  status: ResourceStatus;
  currentBorrowerId: string | null;
  dueDate: string | null;
  heldForMemberId: string | null;
  reservationQueue: string[];
  // Subclass-specific fields
  isbn?: string;
  genre?: string;
  pages?: number;
  issn?: string;
  volume?: number;
  issue?: number;
  peerReviewed?: boolean;
  issueNumber?: string;
  frequency?: string;
  category?: string;
  fileFormat?: string;
  fileSizeMb?: number;
  accessUrl?: string;
  // Computed polymorphic metadata
  loanPeriodDays?: number;
  dailyFineRate?: number;
}

export interface MemberDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  memberType?: MemberType;
  department: string;
  studentOrStaffId: string;
  borrowLimit: number;
  activeBorrowCount: number;
  unpaidFines: number;
  createdAt: string;
}

export interface TransactionDTO {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: ResourceType;
  memberId: string;
  memberName: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  fineAmount: number;
  finePaid: boolean;
  status: TransactionStatus;
}

export interface ReservationDTO {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: ResourceType;
  memberId: string;
  memberName: string;
  reservedAt: string;
  queuePosition: number;
  status: ReservationStatus;
}

export interface DashboardStatsDTO {
  totalResources: number;
  availableCount: number;
  borrowedCount: number;
  reservedCount: number;
  overdueCount: number;
  totalFinesCollected: number;
  totalUnpaidFines: number;
  totalMembers: number;
  activeReservations: number;
}
