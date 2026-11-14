import { type MemberDTO, MemberType, UserRole } from './interfaces.ts';
import {
  DomainValidationError,
  requireNonEmptyText,
  requireValidEmail,
} from './validation.ts';

/**
 * OOP Principle: ABSTRACTION, INHERITANCE, ENCAPSULATION & POLYMORPHISM
 * ---------------------------------------------------------------------
 * `User` is the abstract base class for all authenticated accounts.
 * `Member` extends `User` and is further specialized into `StudentMember`
 * (limit: 3 active borrows) and `FacultyMember` (limit: 5 active borrows).
 * `Librarian` extends `User` with administrative catalog and ledger permissions.
 */

export abstract class User {
  private _id: string;
  private _name: string;
  private _email: string;
  private _department: string;
  private _studentOrStaffId: string;
  private _createdAt: Date;

  constructor(params: {
    id: string;
    name: string;
    email: string;
    department: string;
    studentOrStaffId: string;
    createdAt?: string | Date;
  }) {
    this._id = requireNonEmptyText(params.id, 'User ID', 2, 80);
    this._name = requireNonEmptyText(params.name, 'Full name', 2, 100);
    this._email = requireValidEmail(params.email);
    this._department = requireNonEmptyText(params.department, 'Department', 2, 80);
    this._studentOrStaffId = requireNonEmptyText(
      params.studentOrStaffId,
      'College ID',
      2,
      40
    );
    this._createdAt = params.createdAt ? new Date(params.createdAt) : new Date();
  }

  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    this._name = requireNonEmptyText(value, 'Full name', 2, 100);
  }

  public get email(): string {
    return this._email;
  }

  public set email(value: string) {
    this._email = requireValidEmail(value);
  }

  public get department(): string {
    return this._department;
  }

  public set department(value: string) {
    this._department = requireNonEmptyText(value, 'Department', 2, 80);
  }

  public get studentOrStaffId(): string {
    return this._studentOrStaffId;
  }

  public set studentOrStaffId(value: string) {
    this._studentOrStaffId = requireNonEmptyText(value, 'College ID', 2, 40);
  }

  public get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  public abstract getRole(): UserRole;
  public abstract toDTO(): MemberDTO;
}

export abstract class Member extends User {
  private _activeBorrowCount: number;
  private _unpaidFines: number;

  constructor(
    params: ConstructorParameters<typeof User>[0] & {
      activeBorrowCount?: number;
      unpaidFines?: number;
    }
  ) {
    super(params);
    const active = params.activeBorrowCount ?? 0;
    const fines = params.unpaidFines ?? 0;
    if (active < 0 || !Number.isInteger(active)) {
      throw new DomainValidationError('Active borrow count cannot be negative.');
    }
    if (fines < 0 || !Number.isFinite(fines)) {
      throw new DomainValidationError('Unpaid fines cannot be negative.');
    }
    this._activeBorrowCount = active;
    this._unpaidFines = Math.round(fines * 100) / 100;
  }

  public get activeBorrowCount(): number {
    return this._activeBorrowCount;
  }

  public set activeBorrowCount(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new DomainValidationError('Active borrow count must be a non-negative integer.');
    }
    this._activeBorrowCount = value;
  }

  public get unpaidFines(): number {
    return this._unpaidFines;
  }

  public set unpaidFines(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new DomainValidationError('Unpaid fines must be a non-negative number.');
    }
    this._unpaidFines = Math.round(value * 100) / 100;
  }

  public override getRole(): UserRole {
    return UserRole.MEMBER;
  }

  // Polymorphic abstract methods for Student vs Faculty borrowing limits
  public abstract getMemberType(): MemberType;
  public abstract getBorrowLimit(): number;

  public validateBorrowEligibility(): void {
    if (this._unpaidFines > 0) {
      throw new DomainValidationError(
        `Borrowing blocked: ₹${this._unpaidFines.toFixed(2)} in unpaid fines must be settled first.`
      );
    }
    const limit = this.getBorrowLimit();
    if (this._activeBorrowCount >= limit) {
      throw new DomainValidationError(
        `Borrow limit reached (${this._activeBorrowCount}/${limit} active items for ${this.getMemberType().toLowerCase()} accounts).`
      );
    }
  }

  public canBorrow(): boolean {
    return this._unpaidFines === 0 && this._activeBorrowCount < this.getBorrowLimit();
  }

  public addFine(amount: number): void {
    if (amount > 0) {
      this._unpaidFines = Math.round((this._unpaidFines + amount) * 100) / 100;
    }
  }

  public payFine(amount?: number): number {
    if (this._unpaidFines <= 0) {
      throw new DomainValidationError('No unpaid fines on this account.');
    }
    const payment = typeof amount === 'number' ? amount : this._unpaidFines;
    if (!Number.isFinite(payment) || payment <= 0) {
      throw new DomainValidationError('Payment amount must be greater than zero.');
    }
    const applied = Math.min(payment, this._unpaidFines);
    this._unpaidFines = Math.max(0, Math.round((this._unpaidFines - applied) * 100) / 100);
    return applied;
  }

  public override toDTO(): MemberDTO {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.getRole(),
      memberType: this.getMemberType(),
      department: this.department,
      studentOrStaffId: this.studentOrStaffId,
      borrowLimit: this.getBorrowLimit(),
      activeBorrowCount: this._activeBorrowCount,
      unpaidFines: this._unpaidFines,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

export class StudentMember extends Member {
  public override getMemberType(): MemberType {
    return MemberType.STUDENT;
  }

  // Polymorphism: Students may borrow up to 3 resources simultaneously
  public override getBorrowLimit(): number {
    return 3;
  }
}

export class FacultyMember extends Member {
  public override getMemberType(): MemberType {
    return MemberType.FACULTY;
  }

  // Polymorphism: Faculty members may borrow up to 5 resources simultaneously
  public override getBorrowLimit(): number {
    return 5;
  }
}

export class Librarian extends User {
  public override getRole(): UserRole {
    return UserRole.LIBRARIAN;
  }

  public canManageCatalog(): boolean {
    return true;
  }

  public canManageMembers(): boolean {
    return true;
  }

  public override toDTO(): MemberDTO {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.getRole(),
      department: this.department,
      studentOrStaffId: this.studentOrStaffId,
      borrowLimit: 0,
      activeBorrowCount: 0,
      unpaidFines: 0,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

export function createUserFromDTO(dto: MemberDTO): User {
  if (dto.role === UserRole.LIBRARIAN) {
    return new Librarian({
      id: dto.id,
      name: dto.name,
      email: dto.email,
      department: dto.department,
      studentOrStaffId: dto.studentOrStaffId,
      createdAt: dto.createdAt,
    });
  }

  if (dto.memberType === MemberType.FACULTY) {
    return new FacultyMember({
      id: dto.id,
      name: dto.name,
      email: dto.email,
      department: dto.department,
      studentOrStaffId: dto.studentOrStaffId,
      createdAt: dto.createdAt,
      activeBorrowCount: dto.activeBorrowCount,
      unpaidFines: dto.unpaidFines,
    });
  }

  return new StudentMember({
    id: dto.id,
    name: dto.name,
    email: dto.email,
    department: dto.department,
    studentOrStaffId: dto.studentOrStaffId,
    createdAt: dto.createdAt,
    activeBorrowCount: dto.activeBorrowCount,
    unpaidFines: dto.unpaidFines,
  });
}
