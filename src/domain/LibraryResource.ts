import {
  type Borrowable,
  type BorrowResult,
  type Reservable,
  type ResourceDTO,
  ResourceStatus,
  type ResourceType,
  type ReturnResult,
} from './interfaces.ts';
import {
  DomainValidationError,
  requireNonEmptyText,
  requireValidYear,
  sanitizeText,
} from './validation.ts';

/**
 * OOP Principle: ABSTRACTION & ENCAPSULATION
 * ------------------------------------------
 * `LibraryResource` is an abstract base class representing any catalog item
 * in the college library. It cannot be instantiated directly.
 *
 * - Encapsulation: Core fields are `private`, exposed strictly through
 *   validated getters and setters so invariants cannot be corrupted.
 * - Abstraction: Declares abstract methods (`getResourceType`, `getLoanPeriod`,
 *   `calculateFine`, `getDetails`, `getDailyFineRate`) that concrete subclasses
 *   must implement.
 * - Interfaces: Implements both `Borrowable` and `Reservable`.
 */
export abstract class LibraryResource implements Borrowable, Reservable {
  private _id: string;
  private _title: string;
  private _authorOrPublisher: string;
  private _year: number;
  private _callNumber: string;
  private _status: ResourceStatus;
  private _currentBorrowerId: string | null;
  private _dueDate: Date | null;
  private _heldForMemberId: string | null;
  private _reservationQueue: string[];

  constructor(params: {
    id: string;
    title: string;
    authorOrPublisher: string;
    year: number;
    callNumber: string;
    status?: ResourceStatus;
    currentBorrowerId?: string | null;
    dueDate?: string | Date | null;
    heldForMemberId?: string | null;
    reservationQueue?: string[];
  }) {
    this._id = requireNonEmptyText(params.id, 'Resource ID', 2, 80);
    this._title = requireNonEmptyText(params.title, 'Title', 2, 180);
    this._authorOrPublisher = requireNonEmptyText(
      params.authorOrPublisher,
      'Author / Publisher',
      2,
      140
    );
    this._year = requireValidYear(params.year, 'Publication year');
    this._callNumber = requireNonEmptyText(params.callNumber, 'Call number', 2, 40);
    this._status = params.status ?? ResourceStatus.AVAILABLE;
    this._currentBorrowerId = params.currentBorrowerId ?? null;
    this._dueDate = params.dueDate ? new Date(params.dueDate) : null;
    this._heldForMemberId = params.heldForMemberId ?? null;
    this._reservationQueue = Array.isArray(params.reservationQueue)
      ? [...params.reservationQueue]
      : [];
  }

  // --- Encapsulated Getters & Validated Setters ---

  public get id(): string {
    return this._id;
  }

  public get title(): string {
    return this._title;
  }

  public set title(value: string) {
    this._title = requireNonEmptyText(value, 'Title', 2, 180);
  }

  public get authorOrPublisher(): string {
    return this._authorOrPublisher;
  }

  public set authorOrPublisher(value: string) {
    this._authorOrPublisher = requireNonEmptyText(value, 'Author / Publisher', 2, 140);
  }

  public get year(): number {
    return this._year;
  }

  public set year(value: number) {
    this._year = requireValidYear(value, 'Publication year');
  }

  public get callNumber(): string {
    return this._callNumber;
  }

  public set callNumber(value: string) {
    this._callNumber = requireNonEmptyText(value, 'Call number', 2, 40);
  }

  public get status(): ResourceStatus {
    return this._status;
  }

  public set status(value: ResourceStatus) {
    if (!Object.values(ResourceStatus).includes(value)) {
      throw new DomainValidationError('Invalid resource status.', 'status');
    }
    this._status = value;
  }

  public get currentBorrowerId(): string | null {
    return this._currentBorrowerId;
  }

  public get dueDate(): Date | null {
    return this._dueDate ? new Date(this._dueDate.getTime()) : null;
  }

  public get heldForMemberId(): string | null {
    return this._heldForMemberId;
  }

  public get reservationQueue(): string[] {
    return [...this._reservationQueue];
  }

  // --- Abstract Methods (Polymorphic Contract) ---

  public abstract getResourceType(): ResourceType;
  public abstract getLoanPeriod(): number;
  public abstract getDailyFineRate(): number;
  public abstract calculateFine(daysOverdue: number): number;
  public abstract getDetails(): Record<string, string | number | boolean>;

  // --- Borrowable Interface Implementation ---

  public canBorrow(memberId?: string): boolean {
    if (this._status === ResourceStatus.AVAILABLE) {
      return true;
    }
    if (
      this._status === ResourceStatus.RESERVED &&
      memberId &&
      this._heldForMemberId === memberId
    ) {
      return true;
    }
    return false;
  }

  public borrow(memberId: string, borrowDate: Date = new Date()): BorrowResult {
    const cleanMemberId = sanitizeText(memberId, 80);
    if (!cleanMemberId) {
      throw new DomainValidationError('Valid member ID is required to borrow.');
    }

    if (this._currentBorrowerId === cleanMemberId) {
      throw new DomainValidationError('You already have this resource checked out.');
    }

    if (!this.canBorrow(cleanMemberId)) {
      if (this._status === ResourceStatus.RESERVED && this._heldForMemberId !== cleanMemberId) {
        throw new DomainValidationError(
          'This resource is currently held for the next member in the reservation queue.'
        );
      }
      throw new DomainValidationError('This resource is currently unavailable for borrowing.');
    }

    // If claiming a held reservation, remove member from front of queue
    if (this._status === ResourceStatus.RESERVED && this._heldForMemberId === cleanMemberId) {
      this._reservationQueue = this._reservationQueue.filter((id) => id !== cleanMemberId);
      this._heldForMemberId = null;
    }

    const loanPeriodDays = this.getLoanPeriod();
    const dueDate = new Date(borrowDate.getTime());
    dueDate.setDate(dueDate.getDate() + loanPeriodDays);

    this._currentBorrowerId = cleanMemberId;
    this._dueDate = dueDate;
    this._status = ResourceStatus.BORROWED;

    return { dueDate, loanPeriodDays };
  }

  public returnResource(
    returnDate: Date = new Date(),
    hasPendingReservation?: boolean
  ): ReturnResult {
    if (
      this._status !== ResourceStatus.BORROWED &&
      this._status !== ResourceStatus.OVERDUE
    ) {
      throw new DomainValidationError('Only borrowed or overdue resources can be returned.');
    }

    let daysOverdue = 0;
    if (this._dueDate) {
      const msDiff = returnDate.getTime() - this._dueDate.getTime();
      if (msDiff > 0) {
        daysOverdue = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
      }
    }

    // Polymorphic call: delegates fine math to concrete subclass
    const fineAmount = this.calculateFine(daysOverdue);

    const queueHasWaiter =
      typeof hasPendingReservation === 'boolean'
        ? hasPendingReservation
        : this._reservationQueue.length > 0;

    let nextStatus: ResourceStatus = ResourceStatus.AVAILABLE;
    if (queueHasWaiter && this._reservationQueue.length > 0) {
      nextStatus = ResourceStatus.RESERVED;
      this._heldForMemberId = this._reservationQueue[0];
    } else if (queueHasWaiter) {
      nextStatus = ResourceStatus.RESERVED;
    } else {
      this._heldForMemberId = null;
    }

    this._currentBorrowerId = null;
    this._dueDate = null;
    this._status = nextStatus;

    return { daysOverdue, fineAmount, nextStatus };
  }

  // --- Reservable Interface Implementation ---

  public canReserve(memberId: string): boolean {
    const cleanMemberId = sanitizeText(memberId, 80);
    if (!cleanMemberId) return false;
    if (this._status === ResourceStatus.AVAILABLE) return false;
    if (this._currentBorrowerId === cleanMemberId) return false;
    if (this._heldForMemberId === cleanMemberId) return false;
    if (this._reservationQueue.includes(cleanMemberId)) return false;
    return true;
  }

  public reserve(memberId: string): void {
    const cleanMemberId = sanitizeText(memberId, 80);
    if (!cleanMemberId) {
      throw new DomainValidationError('Valid member ID is required to reserve.');
    }
    if (this._status === ResourceStatus.AVAILABLE) {
      throw new DomainValidationError(
        'Available items can be borrowed directly without a reservation.'
      );
    }
    if (this._currentBorrowerId === cleanMemberId) {
      throw new DomainValidationError('You cannot reserve an item you currently have borrowed.');
    }
    if (
      this._heldForMemberId === cleanMemberId ||
      this._reservationQueue.includes(cleanMemberId)
    ) {
      throw new DomainValidationError('You already have an active reservation for this item.');
    }

    this._reservationQueue.push(cleanMemberId);
  }

  public cancelReservation(memberId: string): void {
    const cleanMemberId = sanitizeText(memberId, 80);
    const wasHeldForMember = this._heldForMemberId === cleanMemberId;
    this._reservationQueue = this._reservationQueue.filter((id) => id !== cleanMemberId);

    if (wasHeldForMember) {
      if (this._reservationQueue.length > 0) {
        this._heldForMemberId = this._reservationQueue[0];
        this._status = ResourceStatus.RESERVED;
      } else {
        this._heldForMemberId = null;
        this._status = ResourceStatus.AVAILABLE;
      }
    }
  }

  public hasReservations(): boolean {
    return this._reservationQueue.length > 0;
  }

  public getNextReserver(): string | null {
    return this._reservationQueue.length > 0 ? this._reservationQueue[0] : null;
  }

  public checkOverdue(referenceDate: Date = new Date()): boolean {
    if (
      (this._status === ResourceStatus.BORROWED || this._status === ResourceStatus.OVERDUE) &&
      this._dueDate
    ) {
      if (referenceDate.getTime() > this._dueDate.getTime()) {
        this._status = ResourceStatus.OVERDUE;
        return true;
      }
      this._status = ResourceStatus.BORROWED;
      return false;
    }
    return false;
  }

  public toDTO(): ResourceDTO {
    return {
      id: this._id,
      type: this.getResourceType(),
      title: this._title,
      authorOrPublisher: this._authorOrPublisher,
      year: this._year,
      callNumber: this._callNumber,
      status: this._status,
      currentBorrowerId: this._currentBorrowerId,
      dueDate: this._dueDate ? this._dueDate.toISOString() : null,
      heldForMemberId: this._heldForMemberId,
      reservationQueue: [...this._reservationQueue],
      loanPeriodDays: this.getLoanPeriod(),
      dailyFineRate: this.getDailyFineRate(),
    };
  }
}
