import { useEffect, useState, type FormEvent } from 'react';
import { Clock, RotateCcw, X } from 'lucide-react';
import { ApiError } from '../api/client.ts';
import {
  MemberType,
  type ResourceDTO,
  type ResourceInput,
  ResourceType,
} from '../domain/index.ts';
import { formatDate, getResourceTypeLabel } from '../utils/format.ts';
import { StatusBadge } from './StatusBadge.tsx';

/* -------------------------------------------------------------------------- */
/* Resource Add / Edit Modal                                                  */
/* -------------------------------------------------------------------------- */

interface ResourceFormModalProps {
  open: boolean;
  editingResource: ResourceDTO | null;
  onClose: () => void;
  onSave: (input: ResourceInput, existingId?: string) => Promise<void>;
}

export function ResourceFormModal({
  open,
  editingResource,
  onClose,
  onSave,
}: ResourceFormModalProps) {
  const [type, setType] = useState<ResourceType>(ResourceType.BOOK);
  const [title, setTitle] = useState('');
  const [authorOrPublisher, setAuthorOrPublisher] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [callNumber, setCallNumber] = useState('');

  // Book
  const [isbn, setIsbn] = useState('');
  const [genre, setGenre] = useState('');
  const [pages, setPages] = useState('320');

  // Journal
  const [issn, setIssn] = useState('');
  const [volume, setVolume] = useState('1');
  const [issue, setIssue] = useState('1');
  const [peerReviewed, setPeerReviewed] = useState(true);

  // Magazine
  const [issueNumber, setIssueNumber] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [category, setCategory] = useState('');

  // Digital
  const [fileFormat, setFileFormat] = useState('PDF');
  const [fileSizeMb, setFileSizeMb] = useState('12.5');
  const [accessUrl, setAccessUrl] = useState('https://library.college.edu/digital/');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingResource) {
      setType(editingResource.type);
      setTitle(editingResource.title);
      setAuthorOrPublisher(editingResource.authorOrPublisher);
      setYear(String(editingResource.year));
      setCallNumber(editingResource.callNumber);
      setIsbn(editingResource.isbn ?? '');
      setGenre(editingResource.genre ?? '');
      setPages(String(editingResource.pages ?? 300));
      setIssn(editingResource.issn ?? '');
      setVolume(String(editingResource.volume ?? 1));
      setIssue(String(editingResource.issue ?? 1));
      setPeerReviewed(editingResource.peerReviewed ?? true);
      setIssueNumber(editingResource.issueNumber ?? '');
      setFrequency(editingResource.frequency ?? 'Monthly');
      setCategory(editingResource.category ?? '');
      setFileFormat(editingResource.fileFormat ?? 'PDF');
      setFileSizeMb(String(editingResource.fileSizeMb ?? 10));
      setAccessUrl(
        editingResource.accessUrl ?? 'https://library.college.edu/digital/resource.pdf'
      );
    } else {
      setType(ResourceType.BOOK);
      setTitle('');
      setAuthorOrPublisher('');
      setYear(String(new Date().getFullYear()));
      setCallNumber('');
      setIsbn('');
      setGenre('');
      setPages('320');
      setIssn('');
      setVolume('1');
      setIssue('1');
      setPeerReviewed(true);
      setIssueNumber('');
      setFrequency('Monthly');
      setCategory('');
      setFileFormat('PDF');
      setFileSizeMb('12.5');
      setAccessUrl('https://library.college.edu/digital/resource.pdf');
    }
  }, [open, editingResource]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError('Title must be at least 2 characters.');
      return;
    }
    if (authorOrPublisher.trim().length < 2) {
      setError('Author or Publisher is required.');
      return;
    }
    const parsedYear = Number(year);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(parsedYear) || parsedYear < 1450 || parsedYear > maxYear) {
      setError(`Publication year must be an integer between 1450 and ${maxYear}.`);
      return;
    }
    if (callNumber.trim().length < 2) {
      setError('Call number is required.');
      return;
    }

    const payload: ResourceInput = {
      type,
      title: title.trim(),
      authorOrPublisher: authorOrPublisher.trim(),
      year: parsedYear,
      callNumber: callNumber.trim(),
    };

    if (type === ResourceType.BOOK) {
      if (isbn.trim().length < 10) {
        setError('ISBN must be at least 10 characters.');
        return;
      }
      if (genre.trim().length < 2) {
        setError('Genre is required for books.');
        return;
      }
      const p = Number(pages);
      if (!Number.isInteger(p) || p <= 0) {
        setError('Pages must be a positive integer.');
        return;
      }
      payload.isbn = isbn.trim();
      payload.genre = genre.trim();
      payload.pages = p;
    } else if (type === ResourceType.JOURNAL) {
      if (issn.trim().length < 7) {
        setError('ISSN must be at least 7 characters.');
        return;
      }
      payload.issn = issn.trim();
      payload.volume = Number(volume);
      payload.issue = Number(issue);
      payload.peerReviewed = peerReviewed;
    } else if (type === ResourceType.MAGAZINE) {
      if (!issueNumber.trim() || !category.trim()) {
        setError('Issue number and category are required for magazines.');
        return;
      }
      payload.issueNumber = issueNumber.trim();
      payload.frequency = frequency.trim();
      payload.category = category.trim();
    } else if (type === ResourceType.DIGITAL) {
      if (!accessUrl.trim().startsWith('http')) {
        setError('Access URL must start with http:// or https://.');
        return;
      }
      payload.fileFormat = fileFormat.trim();
      payload.fileSizeMb = Number(fileSizeMb);
      payload.accessUrl = accessUrl.trim();
    }

    setSubmitting(true);
    try {
      await onSave(payload, editingResource?.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save resource.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="resource-modal-title" className="text-base font-semibold text-slate-900">
            {editingResource ? 'Edit Library Resource' : 'Add Library Resource'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close resource modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="res-type" className="block text-xs font-medium text-slate-700">
              Resource Subclass
            </label>
            <select
              id="res-type"
              disabled={Boolean(editingResource)}
              value={type}
              onChange={(e) => setType(e.target.value as ResourceType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            >
              <option value={ResourceType.BOOK}>Book (14d loan · ₹2/day fine)</option>
              <option value={ResourceType.JOURNAL}>Journal (7d loan · ₹5/day fine)</option>
              <option value={ResourceType.MAGAZINE}>Magazine (5d loan · ₹3/day fine)</option>
              <option value={ResourceType.DIGITAL}>Digital Resource (3d access · No fine)</option>
            </select>
          </div>

          <div>
            <label htmlFor="res-title" className="block text-xs font-medium text-slate-700">
              Title
            </label>
            <input
              id="res-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Structure and Interpretation of Computer Programs"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="res-author" className="block text-xs font-medium text-slate-700">
                Author / Publisher
              </label>
              <input
                id="res-author"
                type="text"
                required
                value={authorOrPublisher}
                onChange={(e) => setAuthorOrPublisher(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="res-year" className="block text-xs font-medium text-slate-700">
                  Year
                </label>
                <input
                  id="res-year"
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </div>
              <div>
                <label htmlFor="res-call" className="block text-xs font-medium text-slate-700">
                  Call No.
                </label>
                <input
                  id="res-call"
                  type="text"
                  required
                  value={callNumber}
                  onChange={(e) => setCallNumber(e.target.value)}
                  placeholder="QA76.6"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          {type === ResourceType.BOOK && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
              <div>
                <label htmlFor="res-isbn" className="block text-xs font-medium text-slate-700">
                  ISBN
                </label>
                <input
                  id="res-isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-0262510875"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="res-genre" className="block text-xs font-medium text-slate-700">
                  Genre
                </label>
                <input
                  id="res-genre"
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Computer Science"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="res-pages" className="block text-xs font-medium text-slate-700">
                  Pages
                </label>
                <input
                  id="res-pages"
                  type="number"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {type === ResourceType.JOURNAL && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
              <div>
                <label htmlFor="res-issn" className="block text-xs font-medium text-slate-700">
                  ISSN
                </label>
                <input
                  id="res-issn"
                  type="text"
                  value={issn}
                  onChange={(e) => setIssn(e.target.value)}
                  placeholder="0098-5589"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="res-volume" className="block text-xs font-medium text-slate-700">
                  Volume
                </label>
                <input
                  id="res-volume"
                  type="number"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="res-issue" className="block text-xs font-medium text-slate-700">
                  Issue
                </label>
                <input
                  id="res-issue"
                  type="number"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <label className="sm:col-span-3 inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={peerReviewed}
                  onChange={(e) => setPeerReviewed(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900"
                />
                <span>Peer-reviewed academic periodical</span>
              </label>
            </div>
          )}

          {type === ResourceType.MAGAZINE && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
              <div>
                <label htmlFor="res-issuenum" className="block text-xs font-medium text-slate-700">
                  Issue No.
                </label>
                <input
                  id="res-issuenum"
                  type="text"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value)}
                  placeholder="Apr 2026"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="res-freq" className="block text-xs font-medium text-slate-700">
                  Frequency
                </label>
                <input
                  id="res-freq"
                  type="text"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="Monthly"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="res-cat" className="block text-xs font-medium text-slate-700">
                  Category
                </label>
                <input
                  id="res-cat"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Technology"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {type === ResourceType.DIGITAL && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3">
              <div>
                <label htmlFor="res-format" className="block text-xs font-medium text-slate-700">
                  Format
                </label>
                <input
                  id="res-format"
                  type="text"
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value)}
                  placeholder="PDF"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="res-size" className="block text-xs font-medium text-slate-700">
                  Size (MB)
                </label>
                <input
                  id="res-size"
                  type="number"
                  step="0.1"
                  value={fileSizeMb}
                  onChange={(e) => setFileSizeMb(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="res-url" className="block text-xs font-medium text-slate-700">
                  Access URL
                </label>
                <input
                  id="res-url"
                  type="url"
                  value={accessUrl}
                  onChange={(e) => setAccessUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting
                ? 'Saving...'
                : editingResource
                  ? 'Save Changes'
                  : 'Add Resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Resource Details Modal                                                     */
/* -------------------------------------------------------------------------- */

export function ResourceDetailsModal({
  resource,
  onClose,
}: {
  resource: ResourceDTO | null;
  onClose: () => void;
}) {
  if (!resource) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="details-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {getResourceTypeLabel(resource.type)} · {resource.callNumber}
            </p>
            <h2 id="details-modal-title" className="mt-0.5 text-base font-semibold text-slate-900">
              {resource.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close resource details"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Current Status</span>
            <StatusBadge status={resource.status} />
          </div>

          <dl className="divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Author / Publisher</dt>
              <dd className="font-medium text-slate-900 text-right">
                {resource.authorOrPublisher}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Year</dt>
              <dd className="font-mono tabular-nums text-slate-900">{resource.year}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Loan Period</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {resource.loanPeriodDays} days
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Overdue Fine Rate</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {resource.dailyFineRate ? `₹${resource.dailyFineRate} / day` : 'No fine'}
              </dd>
            </div>

            {resource.type === ResourceType.BOOK && (
              <>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">ISBN</dt>
                  <dd className="font-mono text-slate-900">{resource.isbn}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Genre / Pages</dt>
                  <dd className="text-slate-900">
                    {resource.genre} · {resource.pages} pp.
                  </dd>
                </div>
              </>
            )}

            {resource.type === ResourceType.JOURNAL && (
              <>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">ISSN</dt>
                  <dd className="font-mono text-slate-900">{resource.issn}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Volume / Issue</dt>
                  <dd className="font-mono text-slate-900">
                    Vol. {resource.volume}, Issue {resource.issue}
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Peer Reviewed</dt>
                  <dd className="text-slate-900">{resource.peerReviewed ? 'Yes' : 'No'}</dd>
                </div>
              </>
            )}

            {resource.type === ResourceType.MAGAZINE && (
              <>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Issue</dt>
                  <dd className="text-slate-900">{resource.issueNumber}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Frequency / Category</dt>
                  <dd className="text-slate-900">
                    {resource.frequency} · {resource.category}
                  </dd>
                </div>
              </>
            )}

            {resource.type === ResourceType.DIGITAL && (
              <>
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Format & Size</dt>
                  <dd className="font-mono text-slate-900">
                    {resource.fileFormat} · {resource.fileSizeMb} MB
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-slate-500 shrink-0">Access Link</dt>
                  <dd className="font-mono text-[11px] text-blue-800 truncate">
                    {resource.accessUrl}
                  </dd>
                </div>
              </>
            )}

            {resource.dueDate && (
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-500">Due Date</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {formatDate(resource.dueDate)}
                </dd>
              </div>
            )}

            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Reservation Queue</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {resource.reservationQueue.length} waiting
              </dd>
            </div>
          </dl>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Member Registration Modal                                                  */
/* -------------------------------------------------------------------------- */

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    email: string;
    password: string;
    memberType: MemberType;
    department: string;
    studentOrStaffId: string;
  }) => Promise<void>;
}

export function MemberFormModal({ open, onClose, onSave }: MemberFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Pass@123');
  const [memberType, setMemberType] = useState<MemberType>(MemberType.STUDENT);
  const [department, setDepartment] = useState('');
  const [studentOrStaffId, setStudentOrStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPassword('Pass@123');
    setMemberType(MemberType.STUDENT);
    setDepartment('');
    setStudentOrStaffId('');
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Member name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid college email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (department.trim().length < 2 || studentOrStaffId.trim().length < 2) {
      setError('Department and College ID are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        password,
        memberType,
        department: department.trim(),
        studentOrStaffId: studentOrStaffId.trim(),
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to register member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="member-modal-title" className="text-base font-semibold text-slate-900">
            Register Library Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="mem-name" className="block text-xs font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="mem-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vikram Menon"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mem-type" className="block text-xs font-medium text-slate-700">
                Member Class
              </label>
              <select
                id="mem-type"
                value={memberType}
                onChange={(e) => setMemberType(e.target.value as MemberType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value={MemberType.STUDENT}>Student (Limit 3)</option>
                <option value={MemberType.FACULTY}>Faculty (Limit 5)</option>
              </select>
            </div>
            <div>
              <label htmlFor="mem-id" className="block text-xs font-medium text-slate-700">
                College ID
              </label>
              <input
                id="mem-id"
                type="text"
                required
                value={studentOrStaffId}
                onChange={(e) => setStudentOrStaffId(e.target.value)}
                placeholder="STU-2026-108"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mem-dept" className="block text-xs font-medium text-slate-700">
              Department
            </label>
            <input
              id="mem-dept"
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Computer Science"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="mem-email" className="block text-xs font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="mem-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vikram@college.edu"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="mem-pass" className="block text-xs font-medium text-slate-700">
              Initial Password
            </label>
            <input
              id="mem-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? 'Registering...' : 'Register Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Demo Mode Time Simulation Modal                                            */
/* -------------------------------------------------------------------------- */

interface DemoModeModalProps {
  open: boolean;
  simulatedOffsetDays: number;
  effectiveDate: string;
  activeCount: number;
  overdueCount: number;
  onClose: () => void;
  onAdvanceDays: (days: number) => Promise<void>;
  onReset: () => Promise<void>;
}

export function DemoModeModal({
  open,
  simulatedOffsetDays,
  effectiveDate,
  activeCount,
  overdueCount,
  onClose,
  onAdvanceDays,
  onReset,
}: DemoModeModalProps) {
  const [daysInput, setDaysInput] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDaysInput('7');
  }, [open]);

  if (!open) return null;

  const runAdvance = async (days: number) => {
    setError(null);
    setSubmitting(true);
    try {
      await onAdvanceDays(days);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to advance simulated date.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(daysInput.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      setError('Enter a whole number of days between 1 and 365.');
      return;
    }
    await runAdvance(parsed);
  };

  const handleReset = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onReset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset simulated date.');
    } finally {
      setSubmitting(false);
    }
  };

  const realTodayIso = new Date().toISOString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="demo-modal-title" className="text-base font-semibold text-slate-900">
                Demo Mode · Time Simulation
              </h2>
              <p className="text-xs text-slate-500">
                Advance the library clock to evaluate overdue status & fines live
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close demo mode modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div>
              <p className="text-slate-500">Real System Date</p>
              <p className="mt-0.5 font-mono font-medium tabular-nums text-slate-800">
                {formatDate(realTodayIso)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Simulated Date</p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-slate-950">
                {formatDate(effectiveDate)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Clock Offset</p>
              <p
                className={`mt-0.5 font-mono font-semibold tabular-nums ${
                  simulatedOffsetDays > 0 ? 'text-amber-800' : 'text-slate-800'
                }`}
              >
                {simulatedOffsetDays > 0 ? `+${simulatedOffsetDays} days` : 'Live (0 days)'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Loan Snapshot</p>
              <p className="mt-0.5 font-mono tabular-nums text-slate-900">
                {activeCount} active ·{' '}
                <span className={overdueCount > 0 ? 'font-semibold text-rose-700' : ''}>
                  {overdueCount} overdue
                </span>
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">Quick Advance</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 7, 15].map((days) => (
                <button
                  key={days}
                  type="button"
                  disabled={submitting}
                  onClick={() => runAdvance(days)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  +{days}d
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2" noValidate>
            <label htmlFor="demo-days-input" className="block text-xs font-medium text-slate-700">
              Advance by N days
            </label>
            <div className="flex gap-2">
              <input
                id="demo-days-input"
                type="number"
                min={1}
                max={365}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {submitting ? 'Simulating...' : 'Advance Clock'}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={submitting || simulatedOffsetDays === 0}
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset to Today</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
