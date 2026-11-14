import {
  type ReservationDTO,
  ReservationStatus,
  type ResourceType,
  type TransactionDTO,
  TransactionStatus,
} from './interfaces.ts';
import { LibraryResource } from './LibraryResource.ts';
import { DomainValidationError, requireNonEmptyText } from './validation.ts';

/**
 * OOP Classes: Transaction, Reservation, FineCalculator
 * ----------------------------------------------------
 * Encapsulates circulation records, queue entries, and polymorphic fine math.
 */

export class Transaction {
  private _id: string;
  private _resourceId: string;
  private _resourceTitle: string;
  private _resourceType: ResourceType;
  private _memberId: string;
  private _memberName: string;
  private _borrowDate: Date;
  private _dueDate: Date;
  private _returnDate: Date | null;
  private _fineAmount: number;
  private _finePaid: boolean;
  private _status: TransactionStatus;

  constructor(params: {
    id: string;
    resourceId: string;
    resourceTitle: string;
    resourceType: ResourceType;
    memberId: string;
    memberName: string;
    borrowDate: string | Date;
    dueDate: string | Date;
    returnDate?: string | Date | null;
    fineAmount?: number;
    finePaid?: boolean;
    status?: TransactionStatus;
  }) {
    this._id = requireNonEmptyText(params.id, 'Transaction ID', 2, 80);
    this._resourceId = requireNonEmptyText(params.resourceId, 'Resource ID', 2, 80);
    this._resourceTitle = requireNonEmptyText(params.resourceTitle, 'Resource title', 2, 180);
    this._resourceType = params.resourceType;
    this._memberId = requireNonEmptyText(params.memberId, 'Member ID', 2, 80);
    this._memberName = requireNonEmptyText(params.memberName, 'Member name', 2, 100);
    this._borrowDate = new Date(params.borrowDate);
    this._dueDate = new Date(params.dueDate);
    this._returnDate = params.returnDate ? new Date(params.returnDate) : null;
    this._fineAmount = Math.max(0, Math.round((params.fineAmount ?? 0) * 100) / 100);
    this._finePaid = Boolean(params.finePaid);
    this._status = params.status ?? TransactionStatus.ACTIVE;
  }

  public get id(): string {
    return this._id;
  }

  public get resourceId(): string {
    return this._resourceId;
  }

  public get resourceTitle(): string {
    return this._resourceTitle;
  }

  public get resourceType(): ResourceType {
    return this._resourceType;
  }

  public get memberId(): string {
    return this._memberId;
  }

  public get memberName(): string {
    return this._memberName;
  }

  public get borrowDate(): Date {
    return new Date(this._borrowDate.getTime());
  }

  public get dueDate(): Date {
    return new Date(this._dueDate.getTime());
  }

  public get returnDate(): Date | null {
    return this._returnDate ? new Date(this._returnDate.getTime()) : null;
  }

  public get fineAmount(): number {
    return this._fineAmount;
  }

  public get finePaid(): boolean {
    return this._finePaid;
  }

  public get status(): TransactionStatus {
    return this._status;
  }

  public markReturned(returnDate: Date, fineAmount: number): void {
    if (this._status === TransactionStatus.RETURNED) {
      throw new DomainValidationError('Transaction has already been closed.');
    }
    this._returnDate = new Date(returnDate.getTime());
    this._fineAmount = Math.max(0, Math.round(fineAmount * 100) / 100);
    this._finePaid = this._fineAmount === 0;
    this._status = TransactionStatus.RETURNED;
  }

  public markFinePaid(): void {
    this._finePaid = true;
  }

  public syncOverdueStatus(referenceDate: Date = new Date()): boolean {
    if (this._status === TransactionStatus.ACTIVE || this._status === TransactionStatus.OVERDUE) {
      if (referenceDate.getTime() > this._dueDate.getTime()) {
        this._status = TransactionStatus.OVERDUE;
        return true;
      }
      this._status = TransactionStatus.ACTIVE;
      return false;
    }
    return false;
  }

  public toDTO(): TransactionDTO {
    return {
      id: this._id,
      resourceId: this._resourceId,
      resourceTitle: this._resourceTitle,
      resourceType: this._resourceType,
      memberId: this._memberId,
      memberName: this._memberName,
      borrowDate: this._borrowDate.toISOString(),
      dueDate: this._dueDate.toISOString(),
      returnDate: this._returnDate ? this._returnDate.toISOString() : null,
      fineAmount: this._fineAmount,
      finePaid: this._finePaid,
      status: this._status,
    };
  }
}

export class Reservation {
  private _id: string;
  private _resourceId: string;
  private _resourceTitle: string;
  private _resourceType: ResourceType;
  private _memberId: string;
  private _memberName: string;
  private _reservedAt: Date;
  private _queuePosition: number;
  private _status: ReservationStatus;

  constructor(params: {
    id: string;
    resourceId: string;
    resourceTitle: string;
    resourceType: ResourceType;
    memberId: string;
    memberName: string;
    reservedAt?: string | Date;
    queuePosition: number;
    status?: ReservationStatus;
  }) {
    this._id = requireNonEmptyText(params.id, 'Reservation ID', 2, 80);
    this._resourceId = requireNonEmptyText(params.resourceId, 'Resource ID', 2, 80);
    this._resourceTitle = requireNonEmptyText(params.resourceTitle, 'Resource title', 2, 180);
    this._resourceType = params.resourceType;
    this._memberId = requireNonEmptyText(params.memberId, 'Member ID', 2, 80);
    this._memberName = requireNonEmptyText(params.memberName, 'Member name', 2, 100);
    this._reservedAt = params.reservedAt ? new Date(params.reservedAt) : new Date();
    this._queuePosition = Math.max(1, Math.floor(params.queuePosition));
    this._status = params.status ?? ReservationStatus.WAITING;
  }

  public get id(): string {
    return this._id;
  }

  public get resourceId(): string {
    return this._resourceId;
  }

  public get resourceTitle(): string {
    return this._resourceTitle;
  }

  public get resourceType(): ResourceType {
    return this._resourceType;
  }

  public get memberId(): string {
    return this._memberId;
  }

  public get memberName(): string {
    return this._memberName;
  }

  public get reservedAt(): Date {
    return new Date(this._reservedAt.getTime());
  }

  public get queuePosition(): number {
    return this._queuePosition;
  }

  public set queuePosition(value: number) {
    this._queuePosition = Math.max(1, Math.floor(value));
  }

  public get status(): ReservationStatus {
    return this._status;
  }

  public holdForPickup(): void {
    this._status = ReservationStatus.HELD;
    this._queuePosition = 1;
  }

  public markFulfilled(): void {
    this._status = ReservationStatus.FULFILLED;
  }

  public cancel(): void {
    this._status = ReservationStatus.CANCELLED;
  }

  public toDTO(): ReservationDTO {
    return {
      id: this._id,
      resourceId: this._resourceId,
      resourceTitle: this._resourceTitle,
      resourceType: this._resourceType,
      memberId: this._memberId,
      memberName: this._memberName,
      reservedAt: this._reservedAt.toISOString(),
      queuePosition: this._queuePosition,
      status: this._status,
    };
  }
}

/**
 * OOP Service Class: FineCalculator
 * Demonstrates Polymorphism by accepting any `LibraryResource` instance
 * and invoking its overridden `calculateFine(daysOverdue)` method.
 */
export class FineCalculator {
  public static computeDaysOverdue(dueDate: Date, referenceDate: Date = new Date()): number {
    const diffMs = referenceDate.getTime() - dueDate.getTime();
    if (diffMs <= 0) {
      return 0;
    }
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  public calculate(
    resource: LibraryResource,
    dueDate: Date,
    returnDate: Date = new Date()
  ): { daysOverdue: number; fineAmount: number; dailyRate: number } {
    const daysOverdue = FineCalculator.computeDaysOverdue(dueDate, returnDate);
    // Polymorphic dispatch: Book=₹2/d, Journal=₹5/d, Magazine=₹3/d, Digital=₹0/d
    const fineAmount = resource.calculateFine(daysOverdue);
    return {
      daysOverdue,
      fineAmount,
      dailyRate: resource.getDailyFineRate(),
    };
  }
}
