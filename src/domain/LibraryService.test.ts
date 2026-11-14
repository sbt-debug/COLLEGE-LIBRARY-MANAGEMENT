import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Book,
  DigitalResource,
  DomainValidationError,
  FacultyMember,
  FineCalculator,
  Journal,
  LibraryService,
  Magazine,
  MemberType,
  ReservationStatus,
  ResourceStatus,
  ResourceType,
  StudentMember,
  TransactionStatus,
  UserRole,
} from './index.ts';

test('Polymorphism: each LibraryResource subclass enforces distinct loan period and fine rate', () => {
  const book = new Book({
    id: 'res-book-1',
    title: 'Design Patterns',
    authorOrPublisher: 'Erich Gamma et al.',
    year: 1994,
    callNumber: 'QA76.76',
    isbn: '978-0201633610',
    genre: 'Computer Science',
    pages: 395,
  });

  const journal = new Journal({
    id: 'res-journal-1',
    title: 'IEEE Transactions on Software Engineering',
    authorOrPublisher: 'IEEE Computer Society',
    year: 2025,
    callNumber: 'PER-IEEE-01',
    issn: '0098-5589',
    volume: 51,
    issue: 4,
    peerReviewed: true,
  });

  const magazine = new Magazine({
    id: 'res-mag-1',
    title: 'MIT Technology Review',
    authorOrPublisher: 'MIT Press',
    year: 2026,
    callNumber: 'MAG-MIT-02',
    issueNumber: 'Vol. 129 No. 2',
    frequency: 'Bimonthly',
    category: 'Technology',
  });

  const digital = new DigitalResource({
    id: 'res-dig-1',
    title: 'Distributed Systems Lecture Pack',
    authorOrPublisher: 'MIT OpenCourseWare',
    year: 2025,
    callNumber: 'DIG-CS-104',
    fileFormat: 'PDF',
    fileSizeMb: 18.5,
    accessUrl: 'https://library.college.edu/digital/dist-systems.pdf',
  });

  assert.equal(book.getLoanPeriod(), 14);
  assert.equal(book.calculateFine(4), 8); // ₹2/day

  assert.equal(journal.getLoanPeriod(), 7);
  assert.equal(journal.calculateFine(4), 20); // ₹5/day

  assert.equal(magazine.getLoanPeriod(), 5);
  assert.equal(magazine.calculateFine(4), 12); // ₹3/day

  assert.equal(digital.getLoanPeriod(), 3);
  assert.equal(digital.calculateFine(10), 0); // No fine
});

test('Encapsulation & validation reject malformed fields and sanitize inputs', () => {
  assert.throws(
    () =>
      new Book({
        id: 'b1',
        title: '<script>alert(1)</script>',
        authorOrPublisher: 'Author',
        year: 2024,
        callNumber: 'QA101',
        isbn: '978-0132350884',
        genre: 'CS',
        pages: 250,
      }),
    DomainValidationError
  );

  assert.throws(
    () =>
      new Journal({
        id: 'j1',
        title: 'Valid Journal',
        authorOrPublisher: 'ACM',
        year: 1200,
        callNumber: 'PER-1',
        issn: '1234-5678',
        volume: 1,
        issue: 1,
        peerReviewed: true,
      }),
    DomainValidationError
  );
});

test('Member borrow limits (Student=3, Faculty=5) and unpaid fine blocking', () => {
  const student = new StudentMember({
    id: 'm1',
    name: 'Aarav',
    email: 'aarav@college.edu',
    department: 'CS',
    studentOrStaffId: 'STU-01',
    activeBorrowCount: 3,
    unpaidFines: 0,
  });

  const faculty = new FacultyMember({
    id: 'm2',
    name: 'Dr. Priya',
    email: 'priya@college.edu',
    department: 'ECE',
    studentOrStaffId: 'FAC-01',
    activeBorrowCount: 3,
    unpaidFines: 0,
  });

  assert.equal(student.getBorrowLimit(), 3);
  assert.equal(student.canBorrow(), false);
  assert.throws(() => student.validateBorrowEligibility(), DomainValidationError);

  assert.equal(faculty.getBorrowLimit(), 5);
  assert.equal(faculty.canBorrow(), true);

  faculty.addFine(10);
  assert.equal(faculty.canBorrow(), false);
  assert.throws(() => faculty.validateBorrowEligibility(), /unpaid fines/i);
  faculty.payFine();
  assert.equal(faculty.canBorrow(), true);
});

test('LibraryService enforces reservation queue FIFO hold on return & polymorphic overdue fine', () => {
  const book = new Book({
    id: 'r1',
    title: 'Clean Architecture',
    authorOrPublisher: 'Robert C. Martin',
    year: 2017,
    callNumber: 'QA76.75',
    isbn: '978-0134494166',
    genre: 'Software Engineering',
    pages: 432,
  });

  const student = new StudentMember({
    id: 'u1',
    name: 'Aarav Sharma',
    email: 'aarav@college.edu',
    department: 'CS',
    studentOrStaffId: 'STU-101',
  });

  const faculty = new FacultyMember({
    id: 'u2',
    name: 'Dr. Priya Nair',
    email: 'priya@college.edu',
    department: 'ECE',
    studentOrStaffId: 'FAC-201',
  });

  const service = new LibraryService({
    resources: [book.toDTO()],
    users: [student.toDTO(), faculty.toDTO()],
    transactions: [],
    reservations: [],
  });

  const borrowDay = new Date('2026-10-01T10:00:00Z');
  service.borrowResource({
    resourceId: 'r1',
    memberId: 'u1',
    transactionId: 'tx-1',
    borrowDate: borrowDay,
  });

  // Duplicate borrow by same member is blocked
  assert.throws(
    () =>
      service.borrowResource({
        resourceId: 'r1',
        memberId: 'u1',
        transactionId: 'tx-dup',
        borrowDate: borrowDay,
      }),
    DomainValidationError
  );

  // Faculty reserves the borrowed book
  const resResult = service.reserveResource({
    resourceId: 'r1',
    memberId: 'u2',
    reservationId: 'res-1',
  });
  assert.equal(resResult.reservation.queuePosition, 1);
  assert.equal(resResult.reservation.status, ReservationStatus.WAITING);

  // Student returns 3 days late (14 + 3 = 17 days after Oct 1 => Oct 18)
  const lateReturnDate = new Date('2026-10-18T10:00:00Z');
  const ret = service.returnResource({
    resourceId: 'r1',
    actorId: 'u1',
    actorRole: UserRole.MEMBER,
    returnDate: lateReturnDate,
  });

  assert.equal(ret.daysOverdue, 3);
  assert.equal(ret.fineAmount, 6); // Book: 3 days * ₹2/day
  assert.equal(ret.resource.status, ResourceStatus.RESERVED);
  assert.equal(ret.resource.heldForMemberId, 'u2');
  assert.equal(ret.heldForMemberName, 'Dr. Priya Nair');
  assert.equal(ret.transaction.status, TransactionStatus.RETURNED);

  // Another student cannot hijack a held item
  service.addMember(
    {
      id: 'u3',
      name: 'Rohan Verma',
      email: 'rohan@college.edu',
      memberType: MemberType.STUDENT,
      department: 'ME',
      studentOrStaffId: 'STU-102',
    },
    UserRole.LIBRARIAN
  );

  assert.throws(
    () =>
      service.borrowResource({
        resourceId: 'r1',
        memberId: 'u3',
        transactionId: 'tx-hijack',
      }),
    /held/i
  );

  // Faculty member who holds the reservation CAN borrow it
  const pickup = service.borrowResource({
    resourceId: 'r1',
    memberId: 'u2',
    transactionId: 'tx-2',
  });
  assert.equal(pickup.resource.status, ResourceStatus.BORROWED);
  assert.equal(pickup.resource.currentBorrowerId, 'u2');

  // Verify FineCalculator directly
  const calc = new FineCalculator();
  const sampleJournal = new Journal({
    id: 'j-test',
    title: 'Nature Computing',
    authorOrPublisher: 'Springer Nature',
    year: 2025,
    callNumber: 'PER-NAT-9',
    issn: '2662-8457',
    volume: 5,
    issue: 2,
    peerReviewed: true,
  });
  const due = new Date('2026-10-10T00:00:00Z');
  const returned = new Date('2026-10-12T00:00:00Z');
  const fineBreakdown = calc.calculate(sampleJournal, due, returned);
  assert.equal(fineBreakdown.daysOverdue, 2);
  assert.equal(fineBreakdown.dailyRate, 5);
  assert.equal(fineBreakdown.fineAmount, 10);
});

test('Simulated time progression marks loans overdue and computes live polymorphic fines on return', () => {
  const journal = new Journal({
    id: 'j-sim-1',
    title: 'IEEE Security & Privacy',
    authorOrPublisher: 'IEEE',
    year: 2026,
    callNumber: 'PER-SEC-01',
    issn: '1540-7993',
    volume: 24,
    issue: 1,
    peerReviewed: true,
  });

  const digital = new DigitalResource({
    id: 'd-sim-1',
    title: 'Cloud Systems Handbook',
    authorOrPublisher: 'MIT',
    year: 2026,
    callNumber: 'DIG-CS-99',
    fileFormat: 'PDF',
    fileSizeMb: 10.2,
    accessUrl: 'https://library.college.edu/digital/cloud.pdf',
  });

  const faculty = new FacultyMember({
    id: 'fac-sim-1',
    name: 'Dr. Priya Nair',
    email: 'priya@college.edu',
    department: 'ECE',
    studentOrStaffId: 'FAC-1',
  });

  const service = new LibraryService({
    resources: [journal.toDTO(), digital.toDTO()],
    users: [faculty.toDTO()],
    transactions: [],
    reservations: [],
  });

  const day0 = new Date('2026-11-01T10:00:00Z');
  service.borrowResource({
    resourceId: 'j-sim-1',
    memberId: 'fac-sim-1',
    transactionId: 'tx-j1',
    borrowDate: day0,
  });
  service.borrowResource({
    resourceId: 'd-sim-1',
    memberId: 'fac-sim-1',
    transactionId: 'tx-d1',
    borrowDate: day0,
  });

  // Advance simulated time by 10 days (Journal 7d loan => 3d overdue; Digital 3d => 7d overdue)
  const day10 = new Date('2026-11-11T10:00:00Z');
  const statsDay10 = service.getDashboardStats(day10);
  assert.equal(statsDay10.overdueCount, 2);

  // Resetting time back to day 2 restores ACTIVE / BORROWED state
  const day2 = new Date('2026-11-03T10:00:00Z');
  const statsDay2 = service.getDashboardStats(day2);
  assert.equal(statsDay2.overdueCount, 0);

  // Advance back to day 10 and return both items
  service.syncOverdueStates(day10);
  const jReturn = service.returnResource({
    resourceId: 'j-sim-1',
    actorId: 'fac-sim-1',
    actorRole: UserRole.MEMBER,
    returnDate: day10,
  });
  assert.equal(jReturn.daysOverdue, 3);
  assert.equal(jReturn.fineAmount, 15); // 3 * ₹5/day

  const dReturn = service.returnResource({
    resourceId: 'd-sim-1',
    actorId: 'fac-sim-1',
    actorRole: UserRole.MEMBER,
    returnDate: day10,
  });
  assert.equal(dReturn.daysOverdue, 7);
  assert.equal(dReturn.fineAmount, 0); // Digital resource has ₹0 fine
});
