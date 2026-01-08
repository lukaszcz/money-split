import { ValidationError, ValidationErrorCode } from '../utils/validation';
import {
  computeBalances,
  computeSettlementsNoSimplify,
  computeSettlementsSimplified,
  computeSimplificationSteps,
} from '../services/settlementService';
import {
  toScaled,
  fromScaled,
  divideScaled,
  calculateEqualSplit,
  calculatePercentageSplit,
  sumScaled,
  applyExchangeRate,
  ScaledPercentage,
} from '../utils/money';
import { getCurrencySymbol, getCurrencyName } from '../utils/currencies';
import { Expense, GroupMember } from '../services/groupRepository';

describe('ValidationError', () => {
  it('should have correct properties', () => {
    const error = new ValidationError('Test error', 'TEST_CODE', 'testField');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.field).toBe('testField');
    expect(error.name).toBe('ValidationError');
    expect(error instanceof Error).toBe(true);
  });
});

describe('utils/validation - assertDefined', () => {
  it('should not throw for defined values', () => {
    const { assertDefined } = require('../utils/validation');
    expect(() => assertDefined('test', 'testField')).not.toThrow();
    expect(() => assertDefined(0, 'testField')).not.toThrow();
    expect(() => assertDefined(BigInt(0), 'testField')).not.toThrow();
  });

  it('should throw for null', () => {
    const { assertDefined } = require('../utils/validation');
    expect(() => assertDefined(null, 'testField')).toThrow(ValidationError);
    expect(() => assertDefined(null, 'testField')).toThrowError(/cannot be null or undefined/);
  });

  it('should throw for undefined', () => {
    const { assertDefined } = require('../utils/validation');
    expect(() => assertDefined(undefined, 'testField')).toThrow(ValidationError);
    expect(() => assertDefined(undefined, 'testField')).toThrowError(/cannot be null or undefined/);
  });
});

describe('utils/validation - assertNoDuplicateIds', () => {
  it('should not throw for unique IDs', () => {
    const { assertNoDuplicateIds } = require('../utils/validation');
    const items = [
      { id: 'm1', name: 'Alice' },
      { id: 'm2', name: 'Bob' },
    ];
    expect(() => assertNoDuplicateIds(items, 'member')).not.toThrow();
  });

  it('should throw for duplicate IDs', () => {
    const { assertNoDuplicateIds } = require('../utils/validation');
    const items = [
      { id: 'm1', name: 'Alice' },
      { id: 'm1', name: 'Bob' },
    ];
    expect(() => assertNoDuplicateIds(items, 'member')).toThrow(ValidationError);
    expect(() => assertNoDuplicateIds(items, 'member')).toThrowError(/Duplicate member id: m1/);
  });
});

describe('utils/validation - assertPositiveNumber', () => {
  it('should not throw for positive numbers', () => {
    const { assertPositiveNumber } = require('../utils/validation');
    expect(() => assertPositiveNumber(1, 'test')).not.toThrow();
    expect(() => assertPositiveNumber(0.5, 'test')).not.toThrow();
  });

  it('should throw for NaN', () => {
    const { assertPositiveNumber } = require('../utils/validation');
    expect(() => assertPositiveNumber(NaN, 'test')).toThrow(ValidationError);
    expect(() => assertPositiveNumber(NaN, 'test')).toThrowError(/must be a valid number/);
  });

  it('should throw for Infinity', () => {
    const { assertPositiveNumber } = require('../utils/validation');
    expect(() => assertPositiveNumber(Infinity, 'test')).toThrow(ValidationError);
    expect(() => assertPositiveNumber(Infinity, 'test')).toThrowError(/must be a valid number/);
  });

  it('should throw for negative numbers', () => {
    const { assertPositiveNumber } = require('../utils/validation');
    expect(() => assertPositiveNumber(-1, 'test')).toThrow(ValidationError);
  });
});

describe('utils/validation - assertNonNegativeNumber', () => {
  it('should not throw for non-negative numbers', () => {
    const { assertNonNegativeNumber } = require('../utils/validation');
    expect(() => assertNonNegativeNumber(0, 'test')).not.toThrow();
    expect(() => assertNonNegativeNumber(1, 'test')).not.toThrow();
  });

  it('should throw for negative numbers', () => {
    const { assertNonNegativeNumber } = require('../utils/validation');
    expect(() => assertNonNegativeNumber(-1, 'test')).toThrow(ValidationError);
    expect(() => assertNonNegativeNumber(-1, 'test')).toThrowError(/cannot be negative/);
  });
});

describe('utils/validation - assertNonZero', () => {
  it('should not throw for non-zero values', () => {
    const { assertNonZero } = require('../utils/validation');
    expect(() => assertNonZero(1, 'test')).not.toThrow();
    expect(() => assertNonZero(-1, 'test')).not.toThrow();
  });

  it('should throw for zero', () => {
    const { assertNonZero } = require('../utils/validation');
    expect(() => assertNonZero(0, 'test')).toThrow(ValidationError);
    expect(() => assertNonZero(0, 'test')).toThrowError(/cannot be zero/);
  });
});

describe('utils/validation - assertPercentage', () => {
  it('should not throw for valid percentages', () => {
    const { assertPercentage } = require('../utils/validation');
    expect(() => assertPercentage(0, 'test')).not.toThrow();
    expect(() => assertPercentage(50, 'test')).not.toThrow();
    expect(() => assertPercentage(100, 'test')).not.toThrow();
  });

  it('should throw for negative percentages', () => {
    const { assertPercentage } = require('../utils/validation');
    expect(() => assertPercentage(-1, 'test')).toThrow(ValidationError);
  });

  it('should throw for percentages > 100', () => {
    const { assertPercentage } = require('../utils/validation');
    expect(() => assertPercentage(101, 'test')).toThrow(ValidationError);
    expect(() => assertPercentage(101, 'test')).toThrowError(/must be between 0 and 100/);
  });
});

describe('utils/validation - assertPercentages', () => {
  it('should not throw for percentages summing to <= 100', () => {
    const { assertPercentages } = require('../utils/validation');
    expect(() => assertPercentages([50, 50])).not.toThrow();
    expect(() => assertPercentages([100])).not.toThrow();
    expect(() => assertPercentages([33.33, 33.33, 33.33])).not.toThrow();
  });

  it('should throw for percentages summing to > 100', () => {
    const { assertPercentages } = require('../utils/validation');
    expect(() => assertPercentages([60, 50])).toThrow(ValidationError);
  });
});

describe('utils/validation - assertNonEmptyString', () => {
  it('should not throw for non-empty strings', () => {
    const { assertNonEmptyString } = require('../utils/validation');
    expect(() => assertNonEmptyString('test', 'field')).not.toThrow();
    expect(() => assertNonEmptyString('  test  ', 'field')).not.toThrow();
  });

  it('should throw for empty string', () => {
    const { assertNonEmptyString } = require('../utils/validation');
    expect(() => assertNonEmptyString('', 'field')).toThrow(ValidationError);
    expect(() => assertNonEmptyString('', 'field')).toThrowError(/cannot be empty/);
  });

  it('should throw for whitespace-only string', () => {
    const { assertNonEmptyString } = require('../utils/validation');
    expect(() => assertNonEmptyString('   ', 'field')).toThrow(ValidationError);
    expect(() => assertNonEmptyString('   ', 'field')).toThrowError(/cannot be empty/);
  });
});

describe('settlementService validation', () => {
  const createMember = (id: string, name: string): GroupMember => ({
    id,
    groupId: 'group-1',
    name,
    createdAt: new Date().toISOString(),
  });

  it('should throw for null expenses in computeBalances', () => {
    expect(() => computeBalances(null as any, [])).toThrow(ValidationError);
  });

  it('should throw for undefined members in computeBalances', () => {
    expect(() => computeBalances([], undefined as any)).toThrow(ValidationError);
  });

  it('should throw for duplicate member IDs in computeBalances', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m1', 'Bob'),
    ];
    expect(() => computeBalances([], members)).toThrow(ValidationError);
  });

  it('should throw for expense referencing non-existent payer', () => {
    const members = [createMember('m1', 'Alice')];
    const expenses: Expense[] = [{
      id: 'e1',
      groupId: 'group-1',
      description: 'Test',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(100000),
      payerMemberId: 'm2',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(100000),
      createdAt: new Date().toISOString(),
      shares: [],
      paymentType: 'expense',
      splitType: 'equal'
    }];
    expect(() => computeBalances(expenses, members)).toThrow(ValidationError);
  });

  it('should throw for expense share referencing non-existent member', () => {
    const members = [createMember('m1', 'Alice')];
    const expenses: Expense[] = [{
      id: 'e1',
      groupId: 'group-1',
      description: 'Test',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(100000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(100000),
      createdAt: new Date().toISOString(),
      shares: [{ id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) }],
      paymentType: 'expense',
      splitType: 'equal'
    }];
    expect(() => computeBalances(expenses, members)).toThrow(ValidationError);
  });

  it('should accept valid inputs', () => {
    const members = [createMember('m1', 'Alice'), createMember('m2', 'Bob')];
    const expenses: Expense[] = [{
      id: 'e1',
      groupId: 'group-1',
      description: 'Test',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(100000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(100000),
      createdAt: new Date().toISOString(),
      shares: [{ id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) }],
      paymentType: 'expense',
      splitType: 'equal'
    }];

    expect(() => computeBalances(expenses, members)).not.toThrow();
    expect(() => computeSettlementsNoSimplify(expenses, members)).not.toThrow();
    expect(() => computeSettlementsSimplified(expenses, members)).not.toThrow();
    expect(() => computeSimplificationSteps(expenses, members)).not.toThrow();
  });
});

describe('money validation', () => {
  it('should throw for NaN in toScaled', () => {
    expect(() => toScaled(NaN)).toThrow(ValidationError);
  });

  it('should throw for Infinity in toScaled', () => {
    expect(() => toScaled(Infinity)).toThrow(ValidationError);
  });

  it('should throw for null in fromScaled', () => {
    expect(() => fromScaled(null as any)).toThrow(ValidationError);
  });

  it('should throw for undefined in fromScaled', () => {
    expect(() => fromScaled(undefined as any)).toThrow(ValidationError);
  });

  it('should throw for null dividend in divideScaled', () => {
    expect(() => divideScaled(null as any, 2)).toThrow(ValidationError);
  });

  it('should throw for null divisor in divideScaled', () => {
    expect(() => divideScaled(BigInt(100000), null as any)).toThrow(ValidationError);
  });

  it('should throw for division by zero', () => {
    expect(() => divideScaled(BigInt(100000), 0)).toThrow(ValidationError);
  });

  it('should throw for null participant count in calculateEqualSplit', () => {
    expect(() => calculateEqualSplit(BigInt(100000), null as any)).toThrow(ValidationError);
  });

  it('should throw for negative participant count in calculateEqualSplit', () => {
    expect(() => calculateEqualSplit(BigInt(100000), -1)).toThrow(ValidationError);
  });

  it('should throw for invalid percentage in ScaledPercentage', () => {
    expect(() => new ScaledPercentage(-5)).toThrow(ValidationError);
    expect(() => new ScaledPercentage(150)).toThrow(ValidationError);
  });

  it('should throw for null in calculatePercentageSplit', () => {
    expect(() => calculatePercentageSplit(BigInt(100000), null as any)).toThrow(ValidationError);
  });

  it('should throw for percentages summing to > 100', () => {
    expect(() => calculatePercentageSplit(BigInt(100000), [60, 50])).toThrow(ValidationError);
  });

  it('should throw for invalid percentage values in calculatePercentageSplit', () => {
    expect(() => calculatePercentageSplit(BigInt(100000), [-5, 105])).toThrow(ValidationError);
  });

  it('should throw for null in sumScaled', () => {
    expect(() => sumScaled(null as any)).toThrow(ValidationError);
  });

  it('should accept valid inputs', () => {
    expect(() => toScaled(100.50)).not.toThrow();
    expect(() => fromScaled(BigInt(1000000))).not.toThrow();
    expect(() => divideScaled(BigInt(100000), 2)).not.toThrow();
    expect(() => calculateEqualSplit(BigInt(100000), 3)).not.toThrow();
    expect(() => new ScaledPercentage(50)).not.toThrow();
    expect(() => calculatePercentageSplit(BigInt(100000), [50, 50])).not.toThrow();
    expect(() => sumScaled([BigInt(100000), BigInt(200000)])).not.toThrow();
  });
});

describe('currencies validation', () => {
  it('should throw for empty code in getCurrencySymbol', () => {
    expect(() => getCurrencySymbol('')).toThrow(ValidationError);
  });

  it('should throw for whitespace-only code in getCurrencySymbol', () => {
    expect(() => getCurrencySymbol('   ')).toThrow(ValidationError);
  });

  it('should throw for null code in getCurrencySymbol', () => {
    expect(() => getCurrencySymbol(null as any)).toThrow(ValidationError);
  });

  it('should throw for empty code in getCurrencyName', () => {
    expect(() => getCurrencyName('')).toThrow(ValidationError);
  });

  it('should throw for whitespace-only code in getCurrencyName', () => {
    expect(() => getCurrencyName('   ')).toThrow(ValidationError);
  });

  it('should accept valid currency codes', () => {
    expect(() => getCurrencySymbol('USD')).not.toThrow();
    expect(() => getCurrencyName('EUR')).not.toThrow();
  });
});
