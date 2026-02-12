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
- **Service tests** for data and edge-function access (groupRepository, exchangeRateService, authService), including RPC coverage for `getActivityFeed()` mapping and error handling
- **Context tests** for React state management (AuthContext)
- **Recovery auth-flow tests** for atomic recovery-password verification and temporary sign-in provisioning in `AuthContext`
- **Hook tests** for client hooks (currency order, framework ready)
- **Component tests** for reusable UI components (BottomActionBar)
- **Screen tests** for UI business logic (auth, groups, settings, password changes), including safe leave-vs-delete routing in edit-member flows
- **Client configuration tests** for platform-specific Supabase auth session persistence settings, including SecureStore token storage and AsyncStorage user payload storage on native (`lib/supabase.ts`)
- **Integration tests** (optional, requires local Supabase)
- **Exchange-rate cache tests** for AsyncStorage caching, stale fallback behavior, and login prefetch warmup

### Test Statistics

- **Total Tests**: 398
- **Test Suites**: 27
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
│   ├── mockExpoRouter.ts          # Expo Router mocking
│   ├── mockAuthContext.ts         # Auth context mocking
│   ├── testHelpers.ts             # Test utilities
│   └── ui.test.ts                 # UI utilities tests
├── setup/
│   ├── docker-compose.test.yml    # Integration test environment
│   └── integration.setup.ts       # Integration test helpers
├── services/
│   ├── groupRepository.test.ts    # Service layer tests
│   ├── exchangeRateService.test.ts # Exchange rate cache + edge-function tests
│   ├── authService.test.ts        # Authentication edge-function tests
│   ├── currencyPreferenceService.test.ts # Currency preference service
│   ├── groupPreferenceService.test.ts # Group preference service
│   └── settlePreferenceService.test.ts # Settle preference storage
│   ├── userPreferenceCache.test.ts # User preference cache helpers
│   └── userPreferenceSync.test.ts # Preference sync on login
├── contexts/
│   └── AuthContext.test.tsx       # React context tests
├── hooks/
│   ├── useCurrencyOrder.test.ts   # Currency ordering hook
│   └── useFrameworkReady.test.ts  # Framework ready hook
├── lib/
│   └── supabase.test.ts           # Supabase client platform config
├── components/
│   └── BottomActionBar.test.tsx   # BottomActionBar component tests
├── screens/
│   ├── auth.test.tsx              # Auth screen tests
│   ├── passwordRecovery.test.tsx  # Password recovery screen tests
│   ├── recoveryPasswordChange.test.tsx # Forced permanent password setup screen
│   ├── changePassword.test.tsx    # Authenticated password change screen
│   ├── groups.test.tsx            # Groups screen tests
│   ├── groupDetail.test.tsx       # Group detail screen tests
│   ├── editMember.test.tsx        # Edit member screen tests
│   └── settings.test.tsx          # Settings screen tests
├── currencies.test.ts             # Currency utilities
├── money.test.ts                  # Money math
├── settlementService.test.ts      # Settlement algorithms
└── validation.test.ts             # Validation helpers

```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (optimized for CI/CD)
npm run test:ci

# Run specific test file
npm run test -- __tests__/money.test.ts

# Run tests matching a pattern
npm run test -- --testNamePattern="should calculate"

# Run tests for a specific suite
npm run test -- --testPathPattern="groupRepository"
```

### Environment Variables

```bash
# Enable verbose output
VERBOSE=true npm run test

# Set test timeout
TEST_TIMEOUT=10000 npm run test
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

Money utility tests also cover share calculations via `calculateSharesForSplit`.
Validation tests include `validateDecimalInput` coverage.

### UI Utilities Test Pattern

```typescript
import { Dimensions } from 'react-native';
import { getMenuPosition } from '../../utils/ui';

// Mock React Native Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(),
  },
}));

const mockDimensions = Dimensions as jest.Mocked<typeof Dimensions>;

describe('getMenuPosition', () => {
  beforeEach(() => {
    mockDimensions.get.mockReturnValue({
      width: 375,
      height: 667,
      scale: 2,
      fontScale: 1,
    });
  });

  it('should prevent menu from overflowing screen edges', () => {
    const anchor = { x: 350, y: 50, width: 40, height: 40 };
    const insetTop = 44;

    const position = getMenuPosition(anchor, insetTop, 180);

    // Menu should fit within screen bounds
    expect(position.left + 180).toBeLessThanOrEqual(375 - 16);
  });
});
```

UI utility tests cover menu positioning logic, including:

- Basic positioning relative to anchor elements
- Horizontal overflow prevention (left and right edges)
- Vertical positioning with safe area insets
- Edge cases for various screen sizes (phones, tablets)
- Consistency and boundary conditions

### Service Test Pattern with Mocks

Repository methods that need the current user derive it from
`supabase.auth.getSession()`. In tests, prefer mocking `auth.getSession`
for those flows.

```typescript
import {
  createMockSupabaseClient,
  MockSupabaseClient,
} from '../utils/mockSupabase';
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
import {
  waitForCondition,
  generators,
  bigIntMatchers,
} from './utils/testHelpers';

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
import {
  mockUsers,
  mockGroups,
  mockMembers,
  mockExpenses,
} from './fixtures/testData';

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
TEST_INTEGRATION=true npm run test -- --testPathPattern="integration"
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
  waitForSupabase,
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
  "coverageThreshold": {
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
npm run test -- --maxWorkers=2

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
- **Silence expected console errors**: Filter known-noise logs in `jest.setup.js` or mock `console.error` in targeted tests
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

## Component Testing

### Overview

Component tests verify individual UI components in isolation using `@testing-library/react-native`. These tests ensure components:

- Render correctly with various props
- Apply accessibility labels for screen readers
- Call handlers when user interactions occur
- Follow established patterns for testability

### What to Test

✅ **Do test**:

- Component renders with required props
- Accessibility labels are correctly applied
- Event handlers (onPress, onChange) are called correctly
- Component handles edge cases (empty strings, undefined props)

❌ **Don't test**:

- Styling details (colors, sizes, margins)
- Component internal implementation
- Third-party library behavior

### Writing Component Tests

Component tests follow a simple pattern:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BottomActionBar from '../../components/BottomActionBar';

describe('BottomActionBar', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(
      <BottomActionBar label="Add Item" onPress={jest.fn()} />,
    );

    expect(getByText('Add Item')).toBeTruthy();
  });

  it('applies correct accessibility label', () => {
    const { getByLabelText } = render(
      <BottomActionBar label="Add Group" onPress={jest.fn()} />,
    );

    expect(getByLabelText('Add Group')).toBeTruthy();
  });

  it('calls onPress handler when pressed', () => {
    const mockOnPress = jest.fn();
    const { getByLabelText } = render(
      <BottomActionBar label="Add Expense" onPress={mockOnPress} />,
    );

    fireEvent.press(getByLabelText('Add Expense'));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
```

### Example Component Tests

See `__tests__/components/BottomActionBar.test.tsx` for a complete example.

### Tips for Component Testing

1. **Keep tests simple** - Focus on public API, not implementation
2. **Use accessibility queries** - Prefer `getByLabelText` over `getByTestId`
3. **Test user interactions** - Verify handlers are called correctly
4. **Mock child components** - If needed, mock complex children (already handled in `jest.setup.js`)
5. **Avoid snapshot tests** - They're brittle and don't test behavior

## Screen Testing

### Overview

Screen tests render React Native screens with `@testing-library/react-native` and assert on user-visible behavior. This approach is:

- **Fast**: Render-only tests stay quick enough for unit feedback
- **Maintainable**: Assertions target text, labels, and flows instead of layout
- **Workflow-driven**: Exercises real user actions (input, submit, navigate)
- **Accessible**: Encourages labeling icon-only buttons for testability and users

### What to Test

✅ **Do test**:

- Form validation logic
- Authentication flows (sign-in, sign-up, logout)
- Navigation calls (verify correct routes)
- Service layer interactions
- State management
- Error handling
- Loading states

❌ **Don't test**:

- Layout or pixel values
- StyleSheet values
- Component tree structure
- Visual appearance

### Writing Screen Tests

#### 1. Setup Mocks

```typescript
// Mock Expo Router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  router: { push: jest.fn(), replace: jest.fn() },
}));

// Mock Auth Context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock services
jest.mock('@/services/groupRepository', () => ({
  getAllGroups: jest.fn(),
  createGroup: jest.fn(),
}));
```

#### 2. Use Mock Utilities

```typescript
import { createMockAuthContext } from '../utils/mockAuthContext';
import { createMockRouter } from '../utils/mockExpoRouter';

let mockAuthContext = createMockAuthContext();
let mockRouter = createMockRouter();

beforeEach(() => {
  jest.clearAllMocks();
  require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  require('expo-router').useRouter.mockReturnValue(mockRouter);
});
```

#### 3. Render the Screen and Drive User Actions

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../../app/auth';

it('signs in and navigates', async () => {
  const { getByPlaceholderText, getByText } = render(<AuthScreen />);

  fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
  fireEvent.press(getByText('Sign In'));

  await waitFor(() => {
    expect(mockAuthContext.signIn).toHaveBeenCalledWith(
      'test@example.com',
      'password123',
    );
  });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/groups');
});
```

#### 4. Prefer Accessibility Labels for Icon-only Buttons

```typescript
// In screen component
<TouchableOpacity accessibilityLabel=\"Edit display name\" onPress={onEdit} />

// In test
fireEvent.press(getByLabelText('Edit display name'));
```

#### 5. Test Validation Through UI, Not State

```typescript
it('shows a validation error for missing credentials', () => {
  const { getByText } = render(<AuthScreen />);

  fireEvent.press(getByText('Sign In'));

  expect(getByText('Please enter both email and password')).toBeTruthy();
  expect(mockAuthContext.signIn).not.toHaveBeenCalled();
});
```

### Mock Utilities Reference

#### mockExpoRouter.ts

- `createMockRouter()` - Creates router with push/back/replace methods
- `createMockRouterHooks()` - Creates all Expo Router hooks
- `resetMockRouter()` - Clears mock calls
- `updateMockParams()` - Updates useLocalSearchParams return value

#### mockAuthContext.ts

- `createMockUser()` - Creates mock User object
- `createMockSession()` - Creates mock Session object
- `createMockAuthContext()` - Creates full auth context
- `createAuthenticatedContext()` - Shortcut for authenticated user
- `mockSignInSuccess()` - Configures successful sign-in
- `mockSignInFailure()` - Configures failed sign-in

### Example Screen Tests

See these files for complete examples:

- `__tests__/screens/auth.test.tsx` - Authentication flows
- `__tests__/screens/changePassword.test.tsx` - Authenticated password change flow
- `__tests__/screens/groups.test.tsx` - Groups list and navigation
- `__tests__/screens/groupDetail.test.tsx` - Group detail screen, overflow menu, and leave group flows
- `__tests__/screens/settings.test.tsx` - Profile, password-change navigation, logout, delete flows

### Tips for Screen Testing

1. **Test major workflows** - Focus on what users actually do
2. **Avoid brittle tests** - Don't test implementation details
3. **Use descriptive names** - Test names should explain the scenario
4. **Group related tests** - Use describe blocks for organization
5. **Test error paths** - Always test what happens when things fail

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
2. Ensure tests pass: `npm run test`
3. Check coverage: `npm run test:coverage`
4. Update this README if adding new patterns or utilities
5. Keep coverage above thresholds

---

**Happy Testing! 🧪**
