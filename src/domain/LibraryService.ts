import { FineCalculator, Reservation, Transaction } from './Circulation.ts';
import {
  type DashboardStatsDTO,
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
} from './interfaces.ts';
import { LibraryResource } from './LibraryResource.ts';
import {
  Book,
  createResourceFromDTO,
  DigitalResource,
  Journal,
  Magazine,
} from './resources.ts';
import {
  createUserFromDTO,
  FacultyMember,
  Librarian,
  Member,
  StudentMember,
  User,
} from './User.ts';
import {
  DomainValidationError,
  requireNonEmptyText,
  requirePositiveInt,
  requirePositiveNumber,
  requireValidEmail,
  requireValidHttpUrl,
  requireValidYear,
} from './validation.ts';

export interface LibrarySnapshot {
  resources: ResourceDTO[];
  users: MemberDTO[];
  transactions: TransactionDTO[];
  reservations: ReservationDTO[];
}

export interface ResourceInput {
  type: ResourceType;
  title: string;
  authorOrPublisher: string;
  year: number;
  callNumber: string;
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
}

/**
 * OOP Service Facade: LibraryService
 * ----------------------------------
 * Coordinates polymorphic resources, members, transactions, reservation queues,
 * and automatic overdue fine calculations while enforcing all library invariants.
 */
export class LibraryService {
  private _resources: Map<string, LibraryResource>;
  private _users: Map<string, User>;
  private _transactions: Map<string, Transaction>;
  private _reservations: Map<string, Reservation>;
  private _fineCalculator: FineCalculator;

  constructor(snapshot?: LibrarySnapshot) {
    this._resources = new Map();
    this._users = new Map();
    this._transactions = new Map();
    this._reservations = new Map();
    this._fineCalculator = new FineCalculator();

    if (snapshot) {
      for (const r of snapshot.resources) {
        this._resources.set(r.id, createResourceFromDTO(r));
      }
      for (const u of snapshot.users) {
        this._users.set(u.id, createUserFromDTO(u));
      }
      for (const t of snapshot.transactions) {
        this._transactions.set(t.id, new Transaction(t));
      }
      for (const res of snapshot.reservations) {
        this._reservations.set(res.id, new Reservation(res));
      }
    }
  }

  public syncOverdueStates(referenceDate: Date = new Date()): void {
    for (const resource of this._resources.values()) {
      resource.checkOverdue(referenceDate);
    }
    for (const tx of this._transactions.values()) {
      tx.syncOverdueStatus(referenceDate);
    }
  }

  public getResources(referenceDate?: Date): ResourceDTO[] {
    if (referenceDate) {
      this.syncOverdueStates(referenceDate);
    }
    return Array.from(this._resources.values()).map((r) => r.toDTO());
  }

  public getUsers(): MemberDTO[] {
    return Array.from(this._users.values()).map((u) => u.toDTO());
  }

  public getMembers(): MemberDTO[] {
    return Array.from(this._users.values())
      .filter((u): u is Member => u instanceof Member)
      .map((m) => m.toDTO());
  }

  public getTransactions(referenceDate?: Date): TransactionDTO[] {
    if (referenceDate) {
      this.syncOverdueStates(referenceDate);
    }
    return Array.from(this._transactions.values())
      .map((t) => t.toDTO())
      .sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime());
  }

  public getReservations(): ReservationDTO[] {
    return Array.from(this._reservations.values())
      .map((r) => r.toDTO())
      .sort((a, b) => new Date(a.reservedAt).getTime() - new Date(b.reservedAt).getTime());
  }

  public getDashboardStats(referenceDate: Date = new Date()): DashboardStatsDTO {
    this.syncOverdueStates(referenceDate);
    const resources = Array.from(this._resources.values());
    const transactions = Array.from(this._transactions.values());
    const members = Array.from(this._users.values()).filter(
      (u): u is Member => u instanceof Member
    );
    const activeReservations = Array.from(this._reservations.values()).filter(
      (r) => r.status === ReservationStatus.WAITING || r.status === ReservationStatus.HELD
    );

    const totalFinesCollected = transactions
      .filter((t) => t.finePaid && t.fineAmount > 0)
      .reduce((sum, t) => sum + t.fineAmount, 0);

    const totalUnpaidFines = members.reduce((sum, m) => sum + m.unpaidFines, 0);

    return {
      totalResources: resources.length,
      availableCount: resources.filter((r) => r.status === ResourceStatus.AVAILABLE).length,
      borrowedCount: resources.filter(
        (r) => r.status === ResourceStatus.BORROWED || r.status === ResourceStatus.OVERDUE
      ).length,
      reservedCount: resources.filter((r) => r.status === ResourceStatus.RESERVED).length,
      overdueCount: resources.filter((r) => r.status === ResourceStatus.OVERDUE).length,
      totalFinesCollected: Math.round(totalFinesCollected * 100) / 100,
      totalUnpaidFines: Math.round(totalUnpaidFines * 100) / 100,
      totalMembers: members.length,
      activeReservations: activeReservations.length,
    };
  }

  public borrowResource(params: {
    resourceId: string;
    memberId: string;
    transactionId: string;
    borrowDate?: Date;
  }): { transaction: TransactionDTO; resource: ResourceDTO; member: MemberDTO } {
    const borrowDate = params.borrowDate ?? new Date();
    this.syncOverdueStates(borrowDate);

    const resource = this._resources.get(params.resourceId);
    if (!resource) {
      throw new DomainValidationError('Resource not found.');
    }

    const user = this._users.get(params.memberId);
    if (!user || !(user instanceof Member)) {
      throw new DomainValidationError('Only registered library members can borrow resources.');
    }

    // Prevent duplicate borrowing of the same resource
    const existingActiveLoan = Array.from(this._transactions.values()).find(
      (t) =>
        t.resourceId === resource.id &&
        t.memberId === user.id &&
        t.status !== TransactionStatus.RETURNED
    );
    if (existingActiveLoan) {
      throw new DomainValidationError('You already have an active loan for this resource.');
    }

    // Enforce member eligibility (unpaid fines check + Student/Faculty limit)
    user.validateBorrowEligibility();

    // Execute polymorphic borrow on LibraryResource
    const { dueDate } = resource.borrow(user.id, borrowDate);
    user.activeBorrowCount = user.activeBorrowCount + 1;

    // If this member had a HELD reservation on this item, mark it FULFILLED
    for (const res of this._reservations.values()) {
      if (
        res.resourceId === resource.id &&
        res.memberId === user.id &&
        (res.status === ReservationStatus.HELD || res.status === ReservationStatus.WAITING)
      ) {
        res.markFulfilled();
      }
    }
    this.recomputeQueuePositions(resource.id);

    const tx = new Transaction({
      id: params.transactionId,
      resourceId: resource.id,
      resourceTitle: resource.title,
      resourceType: resource.getResourceType(),
      memberId: user.id,
      memberName: user.name,
      borrowDate,
      dueDate,
      fineAmount: 0,
      finePaid: true,
      status: TransactionStatus.ACTIVE,
    });
    this._transactions.set(tx.id, tx);

    return {
      transaction: tx.toDTO(),
      resource: resource.toDTO(),
      member: user.toDTO(),
    };
  }

  public returnResource(params: {
    resourceId: string;
    actorId: string;
    actorRole: UserRole;
    returnDate?: Date;
  }): {
    transaction: TransactionDTO;
    resource: ResourceDTO;
    member: MemberDTO;
    fineAmount: number;
    daysOverdue: number;
    heldForMemberName: string | null;
  } {
    const returnDate = params.returnDate ?? new Date();
    const resource = this._resources.get(params.resourceId);
    if (!resource) {
      throw new DomainValidationError('Resource not found.');
    }

    const activeTx = Array.from(this._transactions.values()).find(
      (t) => t.resourceId === resource.id && t.status !== TransactionStatus.RETURNED
    );
    if (!activeTx) {
      throw new DomainValidationError('No active loan found for this resource.');
    }

    if (params.actorRole !== UserRole.LIBRARIAN && activeTx.memberId !== params.actorId) {
      throw new DomainValidationError('You can only return resources you have borrowed.');
    }

    const borrower = this._users.get(activeTx.memberId);
    if (!borrower || !(borrower instanceof Member)) {
      throw new DomainValidationError('Borrowing member record not found.');
    }

    const { daysOverdue, fineAmount } = this._fineCalculator.calculate(
      resource,
      activeTx.dueDate,
      returnDate
    );

    const waitingQueue = this.getActiveQueueForResource(resource.id);
    const hasPendingReservation = waitingQueue.length > 0;

    resource.returnResource(returnDate, hasPendingReservation);
    activeTx.markReturned(returnDate, fineAmount);

    borrower.activeBorrowCount = Math.max(0, borrower.activeBorrowCount - 1);
    if (fineAmount > 0) {
      borrower.addFine(fineAmount);
    }

    let heldForMemberName: string | null = null;
    if (hasPendingReservation) {
      const nextRes = waitingQueue[0];
      nextRes.holdForPickup();
      heldForMemberName = nextRes.memberName;
      this.recomputeQueuePositions(resource.id);
    }

    return {
      transaction: activeTx.toDTO(),
      resource: resource.toDTO(),
      member: borrower.toDTO(),
      fineAmount,
      daysOverdue,
      heldForMemberName,
    };
  }

  public reserveResource(params: {
    resourceId: string;
    memberId: string;
    reservationId: string;
  }): { reservation: ReservationDTO; resource: ResourceDTO } {
    const resource = this._resources.get(params.resourceId);
    if (!resource) {
      throw new DomainValidationError('Resource not found.');
    }

    const user = this._users.get(params.memberId);
    if (!user || !(user instanceof Member)) {
      throw new DomainValidationError('Only library members can place reservations.');
    }

    resource.reserve(user.id);
    const activeQueue = this.getActiveQueueForResource(resource.id);
    const reservation = new Reservation({
      id: params.reservationId,
      resourceId: resource.id,
      resourceTitle: resource.title,
      resourceType: resource.getResourceType(),
      memberId: user.id,
      memberName: user.name,
      reservedAt: new Date(),
      queuePosition: activeQueue.length + 1,
      status: ReservationStatus.WAITING,
    });
    this._reservations.set(reservation.id, reservation);

    return {
      reservation: reservation.toDTO(),
      resource: resource.toDTO(),
    };
  }

  public cancelReservation(params: {
    reservationId: string;
    actorId: string;
    actorRole: UserRole;
  }): { reservation: ReservationDTO; resource: ResourceDTO } {
    const reservation = this._reservations.get(params.reservationId);
    if (!reservation) {
      throw new DomainValidationError('Reservation not found.');
    }

    if (params.actorRole !== UserRole.LIBRARIAN && reservation.memberId !== params.actorId) {
      throw new DomainValidationError('You can only cancel your own reservations.');
    }

    if (
      reservation.status === ReservationStatus.FULFILLED ||
      reservation.status === ReservationStatus.CANCELLED
    ) {
      throw new DomainValidationError('This reservation is already closed.');
    }

    const resource = this._resources.get(reservation.resourceId);
    if (!resource) {
      throw new DomainValidationError('Associated resource not found.');
    }

    const wasHeld = reservation.status === ReservationStatus.HELD;
    reservation.cancel();
    resource.cancelReservation(reservation.memberId);

    if (wasHeld) {
      const remainingQueue = this.getActiveQueueForResource(resource.id);
      if (remainingQueue.length > 0) {
        remainingQueue[0].holdForPickup();
      }
    }
    this.recomputeQueuePositions(resource.id);

    return {
      reservation: reservation.toDTO(),
      resource: resource.toDTO(),
    };
  }

  public payMemberFines(memberId: string): { member: MemberDTO; amountPaid: number } {
    const user = this._users.get(memberId);
    if (!user || !(user instanceof Member)) {
      throw new DomainValidationError('Member account not found.');
    }

    const amountPaid = user.payFine();
    for (const tx of this._transactions.values()) {
      if (tx.memberId === memberId && !tx.finePaid) {
        tx.markFinePaid();
      }
    }

    return { member: user.toDTO(), amountPaid };
  }

  public addResource(id: string, input: ResourceInput, actorRole: UserRole): ResourceDTO {
    if (actorRole !== UserRole.LIBRARIAN) {
      throw new DomainValidationError('Only librarians can add catalog resources.');
    }

    const title = requireNonEmptyText(input.title, 'Title', 2, 180);
    const authorOrPublisher = requireNonEmptyText(
      input.authorOrPublisher,
      'Author / Publisher',
      2,
      140
    );
    const year = requireValidYear(input.year, 'Publication year');
    const callNumber = requireNonEmptyText(input.callNumber, 'Call number', 2, 40);

    let resource: LibraryResource;
    switch (input.type) {
      case ResourceType.BOOK:
        resource = new Book({
          id,
          title,
          authorOrPublisher,
          year,
          callNumber,
          isbn: requireNonEmptyText(input.isbn, 'ISBN', 10, 24),
          genre: requireNonEmptyText(input.genre, 'Genre', 2, 60),
          pages: requirePositiveInt(input.pages, 'Pages', 10000),
        });
        break;
      case ResourceType.JOURNAL:
        resource = new Journal({
          id,
          title,
          authorOrPublisher,
          year,
          callNumber,
          issn: requireNonEmptyText(input.issn, 'ISSN', 7, 20),
          volume: requirePositiveInt(input.volume, 'Volume', 1000),
          issue: requirePositiveInt(input.issue, 'Issue', 500),
          peerReviewed: Boolean(input.peerReviewed),
        });
        break;
      case ResourceType.MAGAZINE:
        resource = new Magazine({
          id,
          title,
          authorOrPublisher,
          year,
          callNumber,
          issueNumber: requireNonEmptyText(input.issueNumber, 'Issue number', 1, 40),
          frequency: requireNonEmptyText(input.frequency, 'Frequency', 2, 40),
          category: requireNonEmptyText(input.category, 'Category', 2, 60),
        });
        break;
      case ResourceType.DIGITAL:
        resource = new DigitalResource({
          id,
          title,
          authorOrPublisher,
          year,
          callNumber,
          fileFormat: requireNonEmptyText(input.fileFormat, 'File format', 2, 20),
          fileSizeMb: requirePositiveNumber(input.fileSizeMb, 'File size (MB)', 5000),
          accessUrl: requireValidHttpUrl(input.accessUrl, 'Access URL'),
        });
        break;
      default:
        throw new DomainValidationError('Invalid resource type.', 'type');
    }

    this._resources.set(resource.id, resource);
    return resource.toDTO();
  }

  public updateResource(id: string, input: ResourceInput, actorRole: UserRole): ResourceDTO {
    if (actorRole !== UserRole.LIBRARIAN) {
      throw new DomainValidationError('Only librarians can update catalog resources.');
    }

    const existing = this._resources.get(id);
    if (!existing) {
      throw new DomainValidationError('Resource not found.');
    }

    const dto = existing.toDTO();
    const updated = createResourceFromDTO({
      ...dto,
      type: input.type ?? dto.type,
      title: requireNonEmptyText(input.title, 'Title', 2, 180),
      authorOrPublisher: requireNonEmptyText(
        input.authorOrPublisher,
        'Author / Publisher',
        2,
        140
      ),
      year: requireValidYear(input.year, 'Publication year'),
      callNumber: requireNonEmptyText(input.callNumber, 'Call number', 2, 40),
      isbn: input.isbn ?? dto.isbn,
      genre: input.genre ?? dto.genre,
      pages: input.pages ?? dto.pages,
      issn: input.issn ?? dto.issn,
      volume: input.volume ?? dto.volume,
      issue: input.issue ?? dto.issue,
      peerReviewed: input.peerReviewed ?? dto.peerReviewed,
      issueNumber: input.issueNumber ?? dto.issueNumber,
      frequency: input.frequency ?? dto.frequency,
      category: input.category ?? dto.category,
      fileFormat: input.fileFormat ?? dto.fileFormat,
      fileSizeMb: input.fileSizeMb ?? dto.fileSizeMb,
      accessUrl: input.accessUrl ?? dto.accessUrl,
    });

    this._resources.set(id, updated);
    return updated.toDTO();
  }

  public deleteResource(id: string, actorRole: UserRole): void {
    if (actorRole !== UserRole.LIBRARIAN) {
      throw new DomainValidationError('Only librarians can delete catalog resources.');
    }
    const existing = this._resources.get(id);
    if (!existing) {
      throw new DomainValidationError('Resource not found.');
    }
    if (existing.status !== ResourceStatus.AVAILABLE) {
      throw new DomainValidationError(
        'Cannot delete a resource that is currently borrowed, overdue, or reserved.'
      );
    }
    this._resources.delete(id);
  }

  public addMember(
    params: {
      id: string;
      name: string;
      email: string;
      memberType: MemberType;
      department: string;
      studentOrStaffId: string;
    },
    actorRole: UserRole
  ): MemberDTO {
    if (actorRole !== UserRole.LIBRARIAN) {
      throw new DomainValidationError('Only librarians can register new members.');
    }

    const cleanEmail = requireValidEmail(params.email);
    const duplicate = Array.from(this._users.values()).find((u) => u.email === cleanEmail);
    if (duplicate) {
      throw new DomainValidationError('A user with this email address already exists.', 'email');
    }

    const member =
      params.memberType === MemberType.FACULTY
        ? new FacultyMember({
            id: params.id,
            name: params.name,
            email: cleanEmail,
            department: params.department,
            studentOrStaffId: params.studentOrStaffId,
          })
        : new StudentMember({
            id: params.id,
            name: params.name,
            email: cleanEmail,
            department: params.department,
            studentOrStaffId: params.studentOrStaffId,
          });

    this._users.set(member.id, member);
    return member.toDTO();
  }

  private getActiveQueueForResource(resourceId: string): Reservation[] {
    return Array.from(this._reservations.values())
      .filter(
        (r) =>
          r.resourceId === resourceId &&
          (r.status === ReservationStatus.WAITING || r.status === ReservationStatus.HELD)
      )
      .sort((a, b) => a.reservedAt.getTime() - b.reservedAt.getTime());
  }

  private recomputeQueuePositions(resourceId: string): void {
    const queue = this.getActiveQueueForResource(resourceId);
    queue.forEach((res, index) => {
      res.queuePosition = index + 1;
    });
  }
}
