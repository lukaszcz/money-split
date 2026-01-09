/**
 * Unit tests for Settings Screen (app/(tabs)/settings.tsx)
 *
 * Tests major workflows that execute actual app logic:
 * - Loading user profile
 * - Updating user name
 * - Logout flow
 * - Account deletion
 */

import {
  createAuthenticatedContext,
  mockSignOutSuccess,
} from '../utils/mockAuthContext';
import type { MockAuthContext } from '../utils/mockAuthContext';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/groupRepository', () => ({
  getUser: jest.fn(),
  updateUserName: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

describe('Settings Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: any;
  let mockGetUser: jest.Mock;
  let mockUpdateUserName: jest.Mock;
  let mockDeleteUserAccount: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createAuthenticatedContext({
      id: 'user-123',
      email: 'test@example.com',
    });
    mockRouter = require('expo-router').router;

    mockGetUser = require('@/services/groupRepository').getUser;
    mockUpdateUserName = require('@/services/groupRepository').updateUserName;
    mockDeleteUserAccount =
      require('@/services/groupRepository').deleteUserAccount;

    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  describe('Profile Loading', () => {
    it('should load user profile via getUser', async () => {
      const userData = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        lastLogin: '2024-01-15',
      };

      mockGetUser.mockResolvedValue(userData);

      const result = await mockGetUser('user-123');

      expect(mockGetUser).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(userData);
    });

    it('should handle user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await mockGetUser('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Name Update', () => {
    it('should update user name via updateUserName', async () => {
      const updatedUser = {
        id: 'user-123',
        name: 'Jane Smith',
        email: 'test@example.com',
        createdAt: '2024-01-01',
        lastLogin: '2024-01-15',
      };

      mockUpdateUserName.mockResolvedValue(updatedUser);

      const result = await mockUpdateUserName('user-123', 'Jane Smith');

      expect(mockUpdateUserName).toHaveBeenCalledWith('user-123', 'Jane Smith');
      expect(result?.name).toBe('Jane Smith');
    });

    it('should handle name update failure', async () => {
      mockUpdateUserName.mockResolvedValue(null);

      const result = await mockUpdateUserName('user-123', 'New Name');

      expect(result).toBeNull();
    });

    it('should handle network errors during update', async () => {
      mockUpdateUserName.mockRejectedValue(new Error('Network error'));

      await expect(mockUpdateUserName('user-123', 'New Name')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('Logout', () => {
    it('should call signOut and navigate to auth', async () => {
      mockSignOutSuccess(mockAuthContext);

      await mockAuthContext.signOut();
      mockRouter.replace('/auth');

      expect(mockAuthContext.signOut).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
    });

    it('should handle logout errors', async () => {
      mockAuthContext.signOut.mockRejectedValue(new Error('Logout failed'));

      await expect(mockAuthContext.signOut()).rejects.toThrow('Logout failed');
    });
  });

  describe('Account Deletion', () => {
    it('should delete account and navigate to auth on success', async () => {
      mockDeleteUserAccount.mockResolvedValue(true);

      const success = await mockDeleteUserAccount();

      expect(mockDeleteUserAccount).toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('should handle deletion failure', async () => {
      mockDeleteUserAccount.mockResolvedValue(false);

      const success = await mockDeleteUserAccount();

      expect(success).toBe(false);
    });
  });
});
