/**
 * Mock Utilities for Expo Router
 *
 * Provides reusable mock factories for testing screens that use Expo Router hooks.
 * This centralizes Expo Router mocking to avoid duplication across screen tests.
 */

export interface MockRouter {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  setParams: jest.Mock;
  canGoBack: jest.Mock<boolean>;
}

export interface MockRouterHooks {
  useRouter: jest.Mock<MockRouter>;
  useLocalSearchParams: jest.Mock<Record<string, any>>;
  useFocusEffect: jest.Mock;
  useSegments: jest.Mock<string[]>;
}

/**
 * Creates a mock router instance with all router methods.
 *
 * @returns Mock router with jest functions for push, back, replace, etc.
 *
 * @example
 * const router = createMockRouter();
 * router.push('/groups');
 * expect(router.push).toHaveBeenCalledWith('/groups');
 */
export function createMockRouter(): MockRouter {
  return {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
}

/**
 * Creates mock implementations for all Expo Router hooks.
 *
 * @param params - Optional search params to return from useLocalSearchParams
 * @param segments - Optional route segments to return from useSegments
 * @returns Object with mocked hook functions
 *
 * @example
 * const hooks = createMockRouterHooks({ id: 'group-123' });
 * jest.mock('expo-router', () => hooks);
 *
 * // In test:
 * const router = hooks.useRouter();
 * router.push('/groups');
 * expect(router.push).toHaveBeenCalledWith('/groups');
 */
export function createMockRouterHooks(
  params: Record<string, any> = {},
  segments: string[] = []
): MockRouterHooks {
  const mockRouter = createMockRouter();

  return {
    useRouter: jest.fn(() => mockRouter),
    useLocalSearchParams: jest.fn(() => params),
    useFocusEffect: jest.fn((callback) => {
      // Call the callback immediately to simulate screen focus
      if (typeof callback === 'function') {
        callback();
      }
    }),
    useSegments: jest.fn(() => segments),
  };
}

/**
 * Resets all mocks on a MockRouterHooks instance.
 * Call this in beforeEach() to ensure clean state between tests.
 *
 * @param hooks - The mock router hooks to reset
 *
 * @example
 * let mockRouterHooks: MockRouterHooks;
 *
 * beforeEach(() => {
 *   mockRouterHooks = createMockRouterHooks();
 *   resetMockRouter(mockRouterHooks);
 * });
 */
export function resetMockRouter(hooks: MockRouterHooks): void {
  // Get router reference before clearing hooks to avoid dirty state
  const router = hooks.useRouter();

  hooks.useRouter.mockClear();
  hooks.useLocalSearchParams.mockClear();
  hooks.useFocusEffect.mockClear();
  hooks.useSegments.mockClear();

  router.push.mockClear();
  router.back.mockClear();
  router.replace.mockClear();
  router.setParams.mockClear();
  router.canGoBack.mockClear();
}

/**
 * Updates the params returned by useLocalSearchParams.
 * Useful for testing different route parameter scenarios.
 *
 * @param hooks - The mock router hooks to update
 * @param newParams - New params to return from useLocalSearchParams
 *
 * @example
 * updateMockParams(mockRouterHooks, { id: 'group-456' });
 * const params = mockRouterHooks.useLocalSearchParams();
 * expect(params.id).toBe('group-456');
 */
export function updateMockParams(
  hooks: MockRouterHooks,
  newParams: Record<string, any>
): void {
  hooks.useLocalSearchParams.mockReturnValue(newParams);
}

/**
 * Updates the segments returned by useSegments.
 * Useful for testing route guard logic.
 *
 * @param hooks - The mock router hooks to update
 * @param newSegments - New segments to return from useSegments
 *
 * @example
 * updateMockSegments(mockRouterHooks, ['(tabs)', 'groups']);
 * const segments = mockRouterHooks.useSegments();
 * expect(segments).toEqual(['(tabs)', 'groups']);
 */
export function updateMockSegments(
  hooks: MockRouterHooks,
  newSegments: string[]
): void {
  hooks.useSegments.mockReturnValue(newSegments);
}
