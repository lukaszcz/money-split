# MoneySplit Test Suite

Comprehensive testing infrastructure for the MoneySplit application.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Integration Tests](#integration-tests)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Overview

The MoneySplit test suite includes:

- **Unit tests** for utilities and business logic (money math, settlement algorithms)
- **Service tests** for data access layer (groupRepository, exchangeRateService)
- **Context tests** for React state management (AuthContext)
- **Integration tests** (optional, requires local Supabase)

### Test Statistics

- **Total Tests**: 181+
- **Test Suites**: 6
- **Coverage Targets**:
  - Lines: 80%
  - Functions: 80%
  - Branches: 70%
  - Statements: 80%

## Test Structure

```
__tests__/
├── README.md                       # This file
├── fixtures/
│   └── testData.ts                # Reusable test data
├── utils/
│   ├── mockSupabase.ts            # Supabase client mocking
│   └── testHelpers.ts             # Test utilities
├── setup/
│   ├── docker-compose.test.yml    # Integration test environment
│   └── integration.setup.ts       # Integration test helpers
├── services/
│   └── groupRepository.test.ts    # Service layer tests
├── contexts/
│   └── AuthContext.test.tsx       # React context tests
├── currencies.test.ts             # Currency utilities
├── money.test.ts                  # Money math
├── settlementService.test.ts      # Settlement algorithms
└── validation.test.ts             # Validation helpers
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (optimized for CI/CD)
npm run test:ci

# Run specific test file
npm test -- __tests__/money.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should calculate"

# Run tests for a specific suite
npm test -- --testPathPattern="groupRepository"
```

### Environment Variables

```bash
# Enable verbose output
VERBOSE=true npm test

# Set test timeout
TEST_TIMEOUT=10000 npm test
```

## Writing Tests

### Unit Test Pattern

```typescript
import { toScaled, fromScaled } from '../utils/money';

describe('money utilities', () => {
  describe('toScaled', () => {
    it('should convert decimal to scaled bigint', () => {
      const result = toScaled(10.5);
      expect(result).toBe(BigInt(105000));
    });

    it('should handle zero', () => {
      expect(toScaled(0)).toBe(BigInt(0));
    });
  });
});
```

### Service Test Pattern with Mocks

```typescript
import { createMockSupabaseClient, MockSupabaseClient } from '../utils/mockSupabase';
import { mockUsers } from '../fixtures/testData';

// Mock the Supabase module
jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;

describe('groupRepository', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    require('../../lib/supabase').supabase = mockSupabase;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should get user by id', async () => {
    const { getUser } = require('../../services/groupRepository');

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: mockUsers.alice,
        error: null,
      }),
    } as any);

    const result = await getUser('user-alice');
    expect(result).toEqual(mockUsers.alice);
  });
});
```

### React Context Test Pattern

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

describe('AuthContext', () => {
  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    expect(result.current.loading).toBe(true);
  });
});
```

## Test Utilities

### Mock Supabase Client

```typescript
import { createMockSupabaseClient } from './utils/mockSupabase';

const mockSupabase = createMockSupabaseClient();

// Mock authentication
mockSupabase.auth.getUser.mockResolvedValue({
  data: { user: mockUser },
  error: null,
});

// Mock database query
mockSupabase.from.mockReturnValue({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
} as any);
```

### Test Helpers

```typescript
import { waitForCondition, generators, bigIntMatchers } from './utils/testHelpers';

// Wait for async condition
await waitForCondition(() => result.current.loading === false);

// Generate test data
const userId = generators.id('user');
const email = generators.email('testuser');
const amount = generators.scaledAmount(1000, 10000);

// BigInt assertions
bigIntMatchers.toBeCloseTo(actualAmount, expectedAmount, BigInt(100));
bigIntMatchers.toBePositive(balance);
```

### Test Fixtures

```typescript
import { mockUsers, mockGroups, mockMembers, mockExpenses } from './fixtures/testData';

// Use pre-defined test data
const alice = mockUsers.alice;
const tripGroup = mockGroups.trip;
const dinnerExpense = mockExpenses.dinner;
```

## Integration Tests

Integration tests run against a real Supabase instance using Docker Compose.

### Setup

1. **Install Docker** and Docker Compose

2. **Start test database**:
```bash
docker-compose -f __tests__/setup/docker-compose.test.yml up -d
```

3. **Wait for services to be healthy**:
```bash
docker-compose -f __tests__/setup/docker-compose.test.yml ps
```

4. **Run migrations** (if needed):
```bash
# Apply migrations to test database
supabase db reset --db-url postgresql://postgres:postgres@localhost:54322/postgres
```

5. **Run integration tests**:
```bash
TEST_INTEGRATION=true npm test -- --testPathPattern="integration"
```

6. **Cleanup**:
```bash
docker-compose -f __tests__/setup/docker-compose.test.yml down -v
```

### Writing Integration Tests

```typescript
import {
  createIntegrationTestClient,
  IntegrationTestHelper,
  waitForSupabase
} from '../setup/integration.setup';

describe('Group Integration Tests', () => {
  let client: SupabaseClient;
  let helper: IntegrationTestHelper;

  beforeAll(async () => {
    const ready = await waitForSupabase();
    if (!ready) {
      throw new Error('Supabase not ready');
    }
    client = createIntegrationTestClient(true);
  });

  beforeEach(() => {
    helper = new IntegrationTestHelper(client);
  });

  afterEach(async () => {
    await helper.cleanup();
  });

  it('should create group end-to-end', async () => {
    // Test implementation
  });
});
```

## Coverage Reports

### Viewing Coverage

After running `npm run test:coverage`, coverage reports are generated in multiple formats:

1. **Terminal output**: Summary printed to console
2. **HTML report**: Open `coverage/lcov-report/index.html` in browser
3. **LCOV file**: `coverage/lcov.info` for CI integration

### Coverage Thresholds

Configured in `package.json`:

```json
{
  "coverageThresholds": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

Tests will fail if coverage drops below these thresholds.

### What's Covered

Coverage includes:
- `services/**/*.ts`
- `contexts/**/*.tsx`
- `utils/**/*.ts`
- `hooks/**/*.ts`

Coverage excludes:
- Type definitions (`*.d.ts`)
- Test files (`__tests__/**`)
- Node modules

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:ci
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
```

### Test Commands for CI

```bash
# Run in CI mode (no watch, coverage, optimized)
npm run test:ci

# Run with specific worker count
npm test -- --maxWorkers=2

# Run with coverage badge generation
npm run test:coverage -- --coverageReporters=json-summary
```

## Best Practices

### 1. Test Organization

- **One test file per module**: `money.ts` → `money.test.ts`
- **Group related tests**: Use `describe` blocks
- **Clear test names**: Use "should [action] [condition]" format
- **Arrange-Act-Assert**: Structure tests in three clear phases

### 2. Mocking

- **Mock at module level**: Mock external dependencies (Supabase, APIs)
- **Use test fixtures**: Reuse common test data
- **Reset mocks**: Clear mocks between tests with `beforeEach`
- **Verify calls**: Check mocks were called as expected

### 3. Async Testing

- **Use async/await**: Prefer over callbacks or `.then()`
- **Wait for conditions**: Use `waitFor` from Testing Library
- **Handle errors**: Test both success and failure paths
- **Clean up**: Always cleanup async resources

### 4. Test Data

- **Use fixtures**: Don't duplicate test data
- **Generate unique IDs**: Avoid conflicts with `generators.id()`
- **Keep data minimal**: Only include fields needed for test
- **Avoid magic numbers**: Use named constants

### 5. Coverage

- **Test edge cases**: Zero, negative, empty, null, undefined
- **Test error paths**: What happens when things go wrong?
- **Test validation**: Invalid inputs should be rejected
- **Don't chase 100%**: Focus on important code paths

### 6. Performance

- **Keep tests fast**: Unit tests should run in milliseconds
- **Parallel execution**: Tests should be independent
- **Mock slow operations**: Don't hit real APIs or databases
- **Use test:watch**: Fast feedback during development

### 7. Maintenance

- **Update tests with code**: Tests are documentation
- **Refactor tests**: Apply same standards as production code
- **Remove obsolete tests**: Delete tests for removed features
- **Review test failures**: Understand why tests fail

## Troubleshooting

### Tests failing with "Cannot find module"

Check that:
- Module path is correct
- Module is exported properly
- Jest `moduleNameMapper` is configured for path aliases

### Tests timing out

- Increase timeout: `jest.setTimeout(10000)` in test file
- Check for missing `await` on promises
- Verify mocks are resolving correctly

### Coverage not updating

- Delete `coverage` directory
- Run `npm run test:coverage` fresh
- Check `collectCoverageFrom` in `package.json`

### React tests failing

- Ensure `@jest-environment jsdom` comment at top of file
- Check React Testing Library is installed
- Verify component mocks are correct

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)

## Contributing

When adding new features:

1. Write tests first (TDD) or alongside implementation
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this README if adding new patterns or utilities
5. Keep coverage above thresholds

---

**Happy Testing! 🧪**
