import { MockSupabaseClient } from './mockSupabase';

/**
 * Wait for a specific condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Suppress console methods during test execution
 */
export function suppressConsole(methods: ('log' | 'error' | 'warn' | 'info')[] = ['error']) {
  const originalMethods: Record<string, any> = {};

  beforeEach(() => {
    methods.forEach(method => {
      originalMethods[method] = console[method];
      console[method] = jest.fn();
    });
  });

  afterEach(() => {
    methods.forEach(method => {
      console[method] = originalMethods[method];
    });
  });
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a rejected promise with an error
 */
export function createRejectedPromise(message: string): Promise<never> {
  return Promise.reject(new Error(message));
}

/**
 * Assert that a function throws an async error
 */
export async function expectAsyncError(
  fn: () => Promise<any>,
  errorMessage?: string
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw but it did not');
  } catch (error) {
    if (errorMessage && error instanceof Error) {
      expect(error.message).toContain(errorMessage);
    }
    return error as Error;
  }
}

/**
 * Mock date/time for consistent testing
 */
export class MockDate {
  private originalDate: DateConstructor;
  private fixedTime: number;

  constructor(isoString: string) {
    this.originalDate = global.Date;
    this.fixedTime = new Date(isoString).getTime();
  }

  install(): void {
    const fixedTime = this.fixedTime;
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedTime);
        } else {
          super(...args);
        }
      }

      static now(): number {
        return fixedTime;
      }
    } as DateConstructor;
  }

  uninstall(): void {
    global.Date = this.originalDate;
  }
}

/**
 * Verify that all mocks have been called the expected number of times
 */
export function verifyMockCalls(
  mocks: Record<string, jest.Mock>,
  expectedCalls: Record<string, number>
): void {
  Object.entries(expectedCalls).forEach(([name, count]) => {
    const mock = mocks[name];
    if (!mock) {
      throw new Error(`Mock ${name} not found`);
    }
    expect(mock).toHaveBeenCalledTimes(count);
  });
}

/**
 * Create a spy on a module export
 */
export function spyOnModule<T>(
  modulePath: string,
  exportName: string
): jest.SpyInstance<T> {
  const module = require(modulePath);
  return jest.spyOn(module, exportName);
}

/**
 * Assert array contains exactly the expected items (order-independent)
 */
export function expectArrayToContainExactly<T>(
  actual: T[],
  expected: T[],
  compareFn?: (a: T, b: T) => boolean
): void {
  expect(actual.length).toBe(expected.length);

  if (compareFn) {
    expected.forEach(expectedItem => {
      expect(actual.some(actualItem => compareFn(actualItem, expectedItem))).toBe(true);
    });
  } else {
    expected.forEach(expectedItem => {
      expect(actual).toContain(expectedItem);
    });
  }
}

/**
 * Create a partial mock of an object, preserving specified methods
 */
export function createPartialMock<T extends object>(
  original: T,
  overrides: Partial<T>
): T {
  return {
    ...original,
    ...overrides,
  };
}

/**
 * Reset all Supabase builder mocks to default state
 */
export function resetSupabaseBuilderMocks(mockClient: MockSupabaseClient): void {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
  };

  mockClient.from.mockReturnValue(builder as any);
}

/**
 * Create a builder chain for Supabase queries
 */
export interface BuilderChain {
  select?: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
  eq?: jest.Mock;
  is?: jest.Mock;
  maybeSingle?: jest.Mock;
  single?: jest.Mock;
  order?: jest.Mock;
}

export function createSupabaseBuilderChain(
  finalResult: { data: any; error: any },
  methodOverrides?: BuilderChain
): any {
  const defaultBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(finalResult),
    single: jest.fn().mockResolvedValue(finalResult),
    order: jest.fn().mockResolvedValue(finalResult),
  };

  return {
    ...defaultBuilder,
    ...methodOverrides,
  };
}

/**
 * Test data generators for common scenarios
 */
export const generators = {
  /**
   * Generate a unique ID for testing
   */
  id: (prefix = 'test'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate an email address for testing
   */
  email: (username = 'test'): string => {
    return `${username}-${Date.now()}@example.com`;
  },

  /**
   * Generate an ISO timestamp
   */
  timestamp: (offset = 0): string => {
    return new Date(Date.now() + offset).toISOString();
  },

  /**
   * Generate a random amount (scaled)
   */
  scaledAmount: (min = 1000, max = 100000): bigint => {
    return BigInt(Math.floor(Math.random() * (max - min) + min));
  },
};

/**
 * Assertion helpers for BigInt
 */
export const bigIntMatchers = {
  toBeCloseTo: (actual: bigint, expected: bigint, tolerance: bigint = BigInt(10)) => {
    const diff = actual > expected ? actual - expected : expected - actual;
    expect(diff).toBeLessThanOrEqual(tolerance);
  },

  toBePositive: (actual: bigint) => {
    expect(actual > BigInt(0)).toBe(true);
  },

  toBeNegative: (actual: bigint) => {
    expect(actual < BigInt(0)).toBe(true);
  },
};
