export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string
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
  EMPTY_STRING: 'EMPTY_STRING'
} as const;

export function assertDefined<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} cannot be null or undefined`, ValidationErrorCode.NULL_OR_UNDEFINED, fieldName);
  }
  return value;
}

export function assertNoDuplicateIds<T extends { id: string }>(items: T[], itemType: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new ValidationError(`Duplicate ${itemType} id: ${item.id}`, ValidationErrorCode.DUPLICATE_ID, 'id');
    }
    ids.add(item.id);
  }
}

export function assertMemberReferencesExist(expenses: any[], members: { id: string }[]): void {
  const memberIds = new Set(members.map(m => m.id));
  for (const expense of expenses) {
    if (!memberIds.has(expense.payerMemberId)) {
      throw new ValidationError(`Expense references non-existent payer: ${expense.payerMemberId}`, ValidationErrorCode.REFERENCED_ID_NOT_FOUND, 'payerMemberId');
    }
    for (const share of expense.shares) {
      if (!memberIds.has(share.memberId)) {
        throw new ValidationError(`Expense share references non-existent member: ${share.memberId}`, ValidationErrorCode.REFERENCED_ID_NOT_FOUND, 'memberId');
      }
    }
  }
}

export function assertPositiveNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value <= 0) {
    throw new ValidationError(`${fieldName} must be positive`, ValidationErrorCode.NEGATIVE_VALUE, fieldName);
  }
}

export function assertNonNegativeNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value < 0) {
    throw new ValidationError(`${fieldName} cannot be negative`, ValidationErrorCode.NEGATIVE_VALUE, fieldName);
  }
}

export function assertNonNegativeBigInt(value: bigint, fieldName: string): void {
  if (typeof value !== 'bigint') {
    throw new ValidationError(`${fieldName} must be a bigint`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value < BigInt(0)) {
    throw new ValidationError(`${fieldName} cannot be negative`, ValidationErrorCode.NEGATIVE_VALUE, fieldName);
  }
}

export function assertNonZero(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value === 0) {
    throw new ValidationError(`${fieldName} cannot be zero`, ValidationErrorCode.DIVISION_BY_ZERO, fieldName);
  }
}

export function assertPercentage(value: number, fieldName: string): void {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value < 0 || value > 100) {
    throw new ValidationError(`${fieldName} must be between 0 and 100`, ValidationErrorCode.INVALID_PERCENTAGE, fieldName);
  }
}

export function assertPercentages(percentages: number[]): void {
  for (let i = 0; i < percentages.length; i++) {
    assertPercentage(percentages[i], `percentages[${i}]`);
  }

  const sum = percentages.reduce((total, p) => total + p, 0);
  if (Math.abs(100.00 - sum) > 0.01) {
    throw new ValidationError(`Percentages must sum to 100%, got ${sum}`, ValidationErrorCode.INVALID_PERCENTAGE_SUM, 'percentages');
  }
}

export function assertNonEmptyString(value: string, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, ValidationErrorCode.INVALID_TYPE, fieldName);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, ValidationErrorCode.EMPTY_STRING, fieldName);
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
