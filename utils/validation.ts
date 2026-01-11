export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const ValidationErrorCode = {
  NULL_OR_UNDEFINED: 'NULL_OR_UNDEFINED',
  INVALID_TYPE: 'INVALID_TYPE',
  DUPLICATE_ID: 'DUPLICATE_ID',
  REFERENCED_ID_NOT_FOUND: 'REFERENCED_ID_NOT_FOUND',
  DIVISION_BY_ZERO: 'DIVISION_BY_ZERO',
  NEGATIVE_VALUE: 'NEGATIVE_VALUE',
  INVALID_PERCENTAGE: 'INVALID_PERCENTAGE',
  INVALID_PERCENTAGE_SUM: 'INVALID_PERCENTAGE_SUM',
  EMPTY_STRING: 'EMPTY_STRING',
} as const;

export function assertDefined<T>(
  value: T | null | undefined,
  fieldName: string,
): T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      `${fieldName} cannot be null or undefined`,
      ValidationErrorCode.NULL_OR_UNDEFINED,
      fieldName,
    );
  }
  return value;
}

export function assertNoDuplicateIds<T extends { id: string }>(
  items: T[],
  itemType: string,
): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new ValidationError(
        `Duplicate ${itemType} id: ${item.id}`,
        ValidationErrorCode.DUPLICATE_ID,
        'id',
      );
    }
    ids.add(item.id);
  }
}

export function assertMemberReferencesExist(
  expenses: any[],
  members: { id: string }[],
): void {
  const memberIds = new Set(members.map((m) => m.id));
  for (const expense of expenses) {
    if (!memberIds.has(expense.payerMemberId)) {
      throw new ValidationError(
        `Expense references non-existent payer: ${expense.payerMemberId}`,
        ValidationErrorCode.REFERENCED_ID_NOT_FOUND,
        'payerMemberId',
      );
    }
    for (const share of expense.shares) {
      if (!memberIds.has(share.memberId)) {
        throw new ValidationError(
          `Expense share references non-existent member: ${share.memberId}`,
          ValidationErrorCode.REFERENCED_ID_NOT_FOUND,
          'memberId',
        );
      }
    }
  }
}

export function assertPositiveNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value <= 0) {
    throw new ValidationError(
      `${fieldName} must be positive`,
      ValidationErrorCode.NEGATIVE_VALUE,
      fieldName,
    );
  }
}

export function assertNonNegativeNumber(
  value: number,
  fieldName: string,
): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value < 0) {
    throw new ValidationError(
      `${fieldName} cannot be negative`,
      ValidationErrorCode.NEGATIVE_VALUE,
      fieldName,
    );
  }
}

export function assertNonNegativeBigInt(
  value: bigint,
  fieldName: string,
): void {
  if (typeof value !== 'bigint') {
    throw new ValidationError(
      `${fieldName} must be a bigint`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value < BigInt(0)) {
    throw new ValidationError(
      `${fieldName} cannot be negative`,
      ValidationErrorCode.NEGATIVE_VALUE,
      fieldName,
    );
  }
}

export function assertNonZero(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value === 0) {
    throw new ValidationError(
      `${fieldName} cannot be zero`,
      ValidationErrorCode.DIVISION_BY_ZERO,
      fieldName,
    );
  }
}

export function assertPercentage(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid number`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value < 0 || value > 100) {
    throw new ValidationError(
      `${fieldName} must be between 0 and 100`,
      ValidationErrorCode.INVALID_PERCENTAGE,
      fieldName,
    );
  }
}

export function assertPercentages(percentages: number[]): void {
  for (let i = 0; i < percentages.length; i++) {
    assertPercentage(percentages[i], `percentages[${i}]`);
  }

  const sum = percentages.reduce((total, p) => total + p, 0);
  if (Math.abs(100.0 - sum) > 0.01) {
    throw new ValidationError(
      `Percentages must sum to 100%, got ${sum}`,
      ValidationErrorCode.INVALID_PERCENTAGE_SUM,
      'percentages',
    );
  }
}

export function assertNonEmptyString(value: string, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      ValidationErrorCode.INVALID_TYPE,
      fieldName,
    );
  }
  if (value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} cannot be empty`,
      ValidationErrorCode.EMPTY_STRING,
      fieldName,
    );
  }
}

export function validateDecimalInput(
  text: string,
  maxDecimals: number = 2,
): string {
  const sanitized = text.replace(/[^0-9.]/g, '');
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('').substring(0, maxDecimals);
  }
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1].substring(0, maxDecimals);
  }
  return sanitized;
}

export function validateIntegerInput(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

export function validatePercentageInput(
  text: string,
  memberId: string,
  participantIds: string[],
  percentages: Record<string, string>,
): string | null {
  const sanitized = validateIntegerInput(text);
  if (sanitized === '') {
    return '';
  }

  const value = parseInt(sanitized, 10);
  if (isNaN(value)) {
    return null;
  }

  const currentTotal = participantIds.reduce((sum, id) => {
    if (id === memberId) return sum;
    const val = parseFloat(percentages[id] || '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const remaining = Math.max(0, 100 - currentTotal);
  const finalValue = Math.min(value, remaining);
  return finalValue.toString();
}

export function validateExactAmountInput(
  text: string,
  memberId: string,
  participantIds: string[],
  exactAmounts: Record<string, string>,
  totalAmount: number,
): string | null {
  const sanitized = validateDecimalInput(text);
  if (sanitized === '' || sanitized === '.') {
    return sanitized;
  }

  const value = parseFloat(sanitized);
  if (isNaN(value)) {
    return null;
  }

  const currentTotal = participantIds.reduce((sum, id) => {
    if (id === memberId) return sum;
    const val = parseFloat(exactAmounts[id] || '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const remaining = Math.max(0, totalAmount - currentTotal);
  if (value > remaining) {
    return remaining.toFixed(2);
  } else {
    return sanitized;
  }
}

export function isValidEmail(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Checks if a member name is a duplicate of any existing member names.
 * Comparison is case-insensitive.
 * @param nameToCheck The name to check for duplicates
 * @param existingNames Array of existing member names to compare against
 * @returns true if the name is a duplicate, false otherwise
 */
export function isDuplicateMemberName(
  nameToCheck: string,
  existingNames: string[],
): boolean {
  const trimmedName = nameToCheck.trim();
  if (!trimmedName) {
    return false;
  }

  // Filter out empty names upfront for efficiency
  const validNames = existingNames.filter((name) => name?.trim());

  return validNames.some(
    (existingName) =>
      existingName.toLowerCase() === trimmedName.toLowerCase(),
  );
}
