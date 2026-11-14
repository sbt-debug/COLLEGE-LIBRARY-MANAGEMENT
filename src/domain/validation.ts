/**
 * Input Sanitization & Domain Validation Utilities
 * ------------------------------------------------
 * Protects encapsulated fields and API payloads against malformed inputs,
 * script injection characters, and out-of-range numeric values.
 */

export class DomainValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'DomainValidationError';
    this.field = field;
  }
}

/**
 * Strips HTML tags, control characters, and collapses excessive whitespace.
 */
export function sanitizeText(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') {
    return '';
  }
  const withoutTags = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutTags.slice(0, maxLength);
}

export function requireNonEmptyText(
  value: unknown,
  fieldName: string,
  minLength = 2,
  maxLength = 200
): string {
  const clean = sanitizeText(value, maxLength);
  if (clean.length < minLength) {
    throw new DomainValidationError(
      `${fieldName} must be at least ${minLength} characters long.`,
      fieldName
    );
  }
  return clean;
}

export function requireValidYear(value: unknown, fieldName = 'Publication year'): number {
  const num = typeof value === 'number' ? value : Number(value);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(num) || num < 1450 || num > maxYear) {
    throw new DomainValidationError(
      `${fieldName} must be an integer between 1450 and ${maxYear}.`,
      fieldName
    );
  }
  return num;
}

export function requirePositiveInt(
  value: unknown,
  fieldName: string,
  max = 100000
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num <= 0 || num > max) {
    throw new DomainValidationError(
      `${fieldName} must be a positive whole number up to ${max}.`,
      fieldName
    );
  }
  return num;
}

export function requirePositiveNumber(
  value: unknown,
  fieldName: string,
  max = 10000
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    throw new DomainValidationError(
      `${fieldName} must be a positive number up to ${max}.`,
      fieldName
    );
  }
  return Math.round(num * 100) / 100;
}

export function requireValidEmail(value: unknown): string {
  const clean = sanitizeText(value, 160).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(clean)) {
    throw new DomainValidationError('Please enter a valid email address.', 'email');
  }
  return clean;
}

export function requireValidHttpUrl(value: unknown, fieldName = 'Access URL'): string {
  const clean = sanitizeText(value, 400);
  if (!clean) {
    throw new DomainValidationError(`${fieldName} is required.`, fieldName);
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid protocol');
    }
    return parsed.toString();
  } catch {
    throw new DomainValidationError(
      `${fieldName} must be a valid http:// or https:// URL.`,
      fieldName
    );
  }
}
