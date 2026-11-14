import { type ResourceDTO, ResourceType } from './interfaces.ts';
import { LibraryResource } from './LibraryResource.ts';
import {
  DomainValidationError,
  requireNonEmptyText,
  requirePositiveInt,
  requirePositiveNumber,
  requireValidHttpUrl,
} from './validation.ts';

/**
 * OOP Principle: INHERITANCE & POLYMORPHISM
 * -----------------------------------------
 * `Book`, `Journal`, `Magazine`, and `DigitalResource` extend `LibraryResource`
 * and override `getLoanPeriod()`, `getDailyFineRate()`, `calculateFine()`,
 * and `getDetails()` with resource-specific behavior.
 */

export class Book extends LibraryResource {
  private _isbn: string;
  private _genre: string;
  private _pages: number;

  constructor(
    params: ConstructorParameters<typeof LibraryResource>[0] & {
      isbn: string;
      genre: string;
      pages: number;
    }
  ) {
    super(params);
    this._isbn = requireNonEmptyText(params.isbn, 'ISBN', 10, 24);
    this._genre = requireNonEmptyText(params.genre, 'Genre', 2, 60);
    this._pages = requirePositiveInt(params.pages, 'Pages', 10000);
  }

  public get isbn(): string {
    return this._isbn;
  }

  public set isbn(value: string) {
    this._isbn = requireNonEmptyText(value, 'ISBN', 10, 24);
  }

  public get genre(): string {
    return this._genre;
  }

  public set genre(value: string) {
    this._genre = requireNonEmptyText(value, 'Genre', 2, 60);
  }

  public get pages(): number {
    return this._pages;
  }

  public set pages(value: number) {
    this._pages = requirePositiveInt(value, 'Pages', 10000);
  }

  public override getResourceType(): ResourceType {
    return ResourceType.BOOK;
  }

  // Polymorphism: Books allow a 14-day loan period
  public override getLoanPeriod(): number {
    return 14;
  }

  public override getDailyFineRate(): number {
    return 2;
  }

  // Polymorphism: Books accrue ₹2 per overdue day
  public override calculateFine(daysOverdue: number): number {
    return daysOverdue > 0 ? daysOverdue * 2 : 0;
  }

  public override getDetails(): Record<string, string | number | boolean> {
    return {
      format: 'Print Monograph',
      isbn: this._isbn,
      genre: this._genre,
      pages: this._pages,
    };
  }

  public override toDTO(): ResourceDTO {
    return {
      ...super.toDTO(),
      isbn: this._isbn,
      genre: this._genre,
      pages: this._pages,
    };
  }
}

export class Journal extends LibraryResource {
  private _issn: string;
  private _volume: number;
  private _issue: number;
  private _peerReviewed: boolean;

  constructor(
    params: ConstructorParameters<typeof LibraryResource>[0] & {
      issn: string;
      volume: number;
      issue: number;
      peerReviewed: boolean;
    }
  ) {
    super(params);
    this._issn = requireNonEmptyText(params.issn, 'ISSN', 7, 20);
    this._volume = requirePositiveInt(params.volume, 'Volume', 1000);
    this._issue = requirePositiveInt(params.issue, 'Issue', 500);
    this._peerReviewed = Boolean(params.peerReviewed);
  }

  public get issn(): string {
    return this._issn;
  }

  public set issn(value: string) {
    this._issn = requireNonEmptyText(value, 'ISSN', 7, 20);
  }

  public get volume(): number {
    return this._volume;
  }

  public set volume(value: number) {
    this._volume = requirePositiveInt(value, 'Volume', 1000);
  }

  public get issue(): number {
    return this._issue;
  }

  public set issue(value: number) {
    this._issue = requirePositiveInt(value, 'Issue', 500);
  }

  public get peerReviewed(): boolean {
    return this._peerReviewed;
  }

  public set peerReviewed(value: boolean) {
    this._peerReviewed = Boolean(value);
  }

  public override getResourceType(): ResourceType {
    return ResourceType.JOURNAL;
  }

  // Polymorphism: Academic Journals have a shorter 7-day loan period
  public override getLoanPeriod(): number {
    return 7;
  }

  public override getDailyFineRate(): number {
    return 5;
  }

  // Polymorphism: Journals accrue ₹5 per overdue day
  public override calculateFine(daysOverdue: number): number {
    return daysOverdue > 0 ? daysOverdue * 5 : 0;
  }

  public override getDetails(): Record<string, string | number | boolean> {
    return {
      format: 'Academic Periodical',
      issn: this._issn,
      volume: this._volume,
      issue: this._issue,
      peerReviewed: this._peerReviewed,
    };
  }

  public override toDTO(): ResourceDTO {
    return {
      ...super.toDTO(),
      issn: this._issn,
      volume: this._volume,
      issue: this._issue,
      peerReviewed: this._peerReviewed,
    };
  }
}

export class Magazine extends LibraryResource {
  private _issueNumber: string;
  private _frequency: string;
  private _category: string;

  constructor(
    params: ConstructorParameters<typeof LibraryResource>[0] & {
      issueNumber: string;
      frequency: string;
      category: string;
    }
  ) {
    super(params);
    this._issueNumber = requireNonEmptyText(params.issueNumber, 'Issue number', 1, 40);
    this._frequency = requireNonEmptyText(params.frequency, 'Frequency', 2, 40);
    this._category = requireNonEmptyText(params.category, 'Category', 2, 60);
  }

  public get issueNumber(): string {
    return this._issueNumber;
  }

  public set issueNumber(value: string) {
    this._issueNumber = requireNonEmptyText(value, 'Issue number', 1, 40);
  }

  public get frequency(): string {
    return this._frequency;
  }

  public set frequency(value: string) {
    this._frequency = requireNonEmptyText(value, 'Frequency', 2, 40);
  }

  public get category(): string {
    return this._category;
  }

  public set category(value: string) {
    this._category = requireNonEmptyText(value, 'Category', 2, 60);
  }

  public override getResourceType(): ResourceType {
    return ResourceType.MAGAZINE;
  }

  // Polymorphism: Magazines allow a 5-day loan period
  public override getLoanPeriod(): number {
    return 5;
  }

  public override getDailyFineRate(): number {
    return 3;
  }

  // Polymorphism: Magazines accrue ₹3 per overdue day
  public override calculateFine(daysOverdue: number): number {
    return daysOverdue > 0 ? daysOverdue * 3 : 0;
  }

  public override getDetails(): Record<string, string | number | boolean> {
    return {
      format: 'Print Magazine',
      issueNumber: this._issueNumber,
      frequency: this._frequency,
      category: this._category,
    };
  }

  public override toDTO(): ResourceDTO {
    return {
      ...super.toDTO(),
      issueNumber: this._issueNumber,
      frequency: this._frequency,
      category: this._category,
    };
  }
}

export class DigitalResource extends LibraryResource {
  private _fileFormat: string;
  private _fileSizeMb: number;
  private _accessUrl: string;

  constructor(
    params: ConstructorParameters<typeof LibraryResource>[0] & {
      fileFormat: string;
      fileSizeMb: number;
      accessUrl: string;
    }
  ) {
    super(params);
    this._fileFormat = requireNonEmptyText(params.fileFormat, 'File format', 2, 20).toUpperCase();
    this._fileSizeMb = requirePositiveNumber(params.fileSizeMb, 'File size (MB)', 5000);
    this._accessUrl = requireValidHttpUrl(params.accessUrl, 'Access URL');
  }

  public get fileFormat(): string {
    return this._fileFormat;
  }

  public set fileFormat(value: string) {
    this._fileFormat = requireNonEmptyText(value, 'File format', 2, 20).toUpperCase();
  }

  public get fileSizeMb(): number {
    return this._fileSizeMb;
  }

  public set fileSizeMb(value: number) {
    this._fileSizeMb = requirePositiveNumber(value, 'File size (MB)', 5000);
  }

  public get accessUrl(): string {
    return this._accessUrl;
  }

  public set accessUrl(value: string) {
    this._accessUrl = requireValidHttpUrl(value, 'Access URL');
  }

  public override getResourceType(): ResourceType {
    return ResourceType.DIGITAL;
  }

  // Polymorphism: Digital licenses grant 3-day access
  public override getLoanPeriod(): number {
    return 3;
  }

  public override getDailyFineRate(): number {
    return 0;
  }

  // Polymorphism: Digital resources auto-expire with ₹0 fine
  public override calculateFine(_daysOverdue: number): number {
    return 0;
  }

  public override getDetails(): Record<string, string | number | boolean> {
    return {
      format: `Digital (${this._fileFormat})`,
      fileFormat: this._fileFormat,
      fileSizeMb: this._fileSizeMb,
      accessUrl: this._accessUrl,
    };
  }

  public override toDTO(): ResourceDTO {
    return {
      ...super.toDTO(),
      fileFormat: this._fileFormat,
      fileSizeMb: this._fileSizeMb,
      accessUrl: this._accessUrl,
    };
  }
}

/**
 * Polymorphic Factory: reconstructs the exact LibraryResource subclass
 * from persisted database rows or API DTO payloads.
 */
export function createResourceFromDTO(dto: ResourceDTO): LibraryResource {
  const base = {
    id: dto.id,
    title: dto.title,
    authorOrPublisher: dto.authorOrPublisher,
    year: dto.year,
    callNumber: dto.callNumber,
    status: dto.status,
    currentBorrowerId: dto.currentBorrowerId,
    dueDate: dto.dueDate,
    heldForMemberId: dto.heldForMemberId,
    reservationQueue: dto.reservationQueue,
  };

  switch (dto.type) {
    case ResourceType.BOOK:
      return new Book({
        ...base,
        isbn: dto.isbn ?? '',
        genre: dto.genre ?? '',
        pages: Number(dto.pages),
      });
    case ResourceType.JOURNAL:
      return new Journal({
        ...base,
        issn: dto.issn ?? '',
        volume: Number(dto.volume),
        issue: Number(dto.issue),
        peerReviewed: Boolean(dto.peerReviewed),
      });
    case ResourceType.MAGAZINE:
      return new Magazine({
        ...base,
        issueNumber: dto.issueNumber ?? '',
        frequency: dto.frequency ?? '',
        category: dto.category ?? '',
      });
    case ResourceType.DIGITAL:
      return new DigitalResource({
        ...base,
        fileFormat: dto.fileFormat ?? 'PDF',
        fileSizeMb: Number(dto.fileSizeMb),
        accessUrl: dto.accessUrl ?? '',
      });
    default:
      throw new DomainValidationError(`Unsupported resource type: ${String(dto.type)}`, 'type');
  }
}
