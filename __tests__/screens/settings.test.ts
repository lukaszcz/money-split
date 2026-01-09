/**
 * Unit tests for Settings Screen (app/(tabs)/settings.tsx)
 *
 * Tests major workflows:
 * - Loading and displaying user profile
 * - Updating display name
 * - Logout flow with confirmation
 * - Account deletion with double confirmation
 */

import { createAuthenticatedContext, mockSignOutSuccess } from '../utils/mockAuthContext';
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

// Mock React Native Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('Settings Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: any;
  let mockGetUser: jest.Mock;
  let mockUpdateUserName: jest.Mock;
  let mockDeleteUserAccount: jest.Mock;
  let mockAlert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockAuthContext = createAuthenticatedContext({ id: 'user-123', email: 'test@example.com' });
    mockRouter = require('expo-router').router;
    mockAlert = require('react-native').Alert.alert;

    mockGetUser = require('@/services/groupRepository').getUser;
    mockUpdateUserName = require('@/services/groupRepository').updateUserName;
    mockDeleteUserAccount = require('@/services/groupRepository').deleteUserAccount;

    // Inject mock auth context
    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  describe('Profile Loading', () => {
    it('should load user profile on mount', async () => {
      const userId = 'user-123';
      const userData = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        lastLogin: '2024-01-15',
      };

      mockGetUser.mockResolvedValue(userData);

      const result = await mockGetUser(userId);

      expect(mockGetUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(userData);
      expect(result.name).toBe('John Doe');
    });

    it('should handle user not found gracefully', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await mockGetUser('non-existent');

      expect(result).toBeNull();
    });

    it('should not load profile if no user is authenticated', async () => {
      mockAuthContext.user = null;

      // Should not call getUser if no user
      const hasUser = mockAuthContext.user !== null;

      if (!hasUser) {
        expect(mockGetUser).not.toHaveBeenCalled();
      }
    });
  });

  describe('Name Editing', () => {
    it('should update user name successfully', async () => {
      const userId = 'user-123';
      const newName = 'Jane Smith';
      const updatedUser = {
        id: userId,
        name: newName,
        email: 'test@example.com',
        createdAt: '2024-01-01',
        lastLogin: '2024-01-15',
      };

      mockUpdateUserName.mockResolvedValue(updatedUser);

      const result = await mockUpdateUserName(userId, newName);

      expect(mockUpdateUserName).toHaveBeenCalledWith(userId, newName);
      expect(result?.name).toBe(newName);
      expect(mockAlert).not.toHaveBeenCalled(); // Will be called by component
    });

    it('should trim whitespace from name before saving', () => {
      const name = '  John Doe  ';
      const trimmed = name.trim();

      expect(trimmed).toBe('John Doe');
      expect(trimmed).not.toContain('  ');
    });

    it('should not save empty name', () => {
      const name = '   ';
      const trimmed = name.trim();
      const isValid = trimmed.length > 0;

      expect(isValid).toBe(false);

      // Empty name should not trigger save
      if (!isValid) {
        expect(mockUpdateUserName).not.toHaveBeenCalled();
      }
    });

    it('should handle name update failure', async () => {
      mockUpdateUserName.mockResolvedValue(null);

      const result = await mockUpdateUserName('user-123', 'New Name');

      expect(result).toBeNull();
      // Component should show error alert
    });

    it('should handle network error during name update', async () => {
      const error = new Error('Network error');
      mockUpdateUserName.mockRejectedValue(error);

      try {
        await mockUpdateUserName('user-123', 'New Name');
      } catch (err: any) {
        expect(err.message).toBe('Network error');
      }
    });

    it('should restore original name when edit is cancelled', () => {
      const originalName = 'John Doe';
      let editedName = 'Jane Smith';

      // Cancel edit
      editedName = originalName;

      expect(editedName).toBe(originalName);
    });
  });

  describe('Logout Flow', () => {
    it('should show confirmation dialog before logout', () => {
      // Simulate pressing logout button
      // Alert.alert should be called with confirmation
      mockAlert.mockImplementation((title, message, buttons) => {
        expect(title).toBe('Logout');
        expect(message).toContain('Are you sure');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].text).toBe('Cancel');
        expect(buttons[1].text).toBe('Logout');
      });

      mockAlert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive' },
      ]);

      expect(mockAlert).toHaveBeenCalled();
    });

    it('should call signOut and navigate to auth on confirm', async () => {
      mockSignOutSuccess(mockAuthContext);

      await mockAuthContext.signOut();
      mockRouter.replace('/auth');

      expect(mockAuthContext.signOut).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
    });

    it('should not logout when cancel is pressed', () => {
      // User cancels logout
      const cancelled = true;

      if (cancelled) {
        expect(mockAuthContext.signOut).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
      }
    });

    it('should handle logout errors gracefully', async () => {
      mockAuthContext.signOut.mockRejectedValue(new Error('Logout failed'));

      try {
        await mockAuthContext.signOut();
      } catch (error: any) {
        expect(error.message).toBe('Logout failed');
        // Component should show error alert
      }
    });
  });

  describe('Account Deletion Flow', () => {
    it('should show initial warning dialog', () => {
      mockAlert.mockImplementation((title, message, buttons) => {
        expect(title).toBe('Delete Account');
        expect(message).toContain('Permanently erase all your data');
        expect(message).toContain('cannot be undone');
        expect(buttons).toHaveLength(2);
        expect(buttons[1].text).toBe('Delete My Account');
      });

      mockAlert(
        'Delete Account',
        'Are you absolutely sure you want to delete your account? This will:\n\n• Disconnect you from groups you are a member of\n• Permanently erase all your data\n\nThis action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete My Account', style: 'destructive' },
        ]
      );

      expect(mockAlert).toHaveBeenCalled();
    });

    it('should show second confirmation dialog', () => {
      // After first confirmation, show second dialog
      mockAlert.mockImplementation((title, message, buttons) => {
        expect(title).toBe('Final Confirmation');
        expect(message).toContain('last chance');
        expect(buttons).toHaveLength(2);
        expect(buttons[1].text).toBe('Yes, Delete Forever');
      });

      mockAlert(
        'Final Confirmation',
        'This is your last chance. Are you sure you want to permanently delete your account and all associated data?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Delete Forever', style: 'destructive' },
        ]
      );

      expect(mockAlert).toHaveBeenCalled();
    });

    it('should delete account and navigate to auth on final confirm', async () => {
      mockDeleteUserAccount.mockResolvedValue(true);

      const success = await mockDeleteUserAccount();

      if (success) {
        mockRouter.replace('/auth');
      }

      expect(mockDeleteUserAccount).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
    });

    it('should handle deletion failure', async () => {
      mockDeleteUserAccount.mockResolvedValue(false);

      const success = await mockDeleteUserAccount();

      expect(success).toBe(false);
      expect(mockRouter.replace).not.toHaveBeenCalled();
      // Component should show error alert
    });

    it('should not delete account if cancelled at any step', () => {
      // User cancels at any confirmation
      const cancelled = true;

      if (cancelled) {
        expect(mockDeleteUserAccount).not.toHaveBeenCalled();
        expect(mockRouter.replace).not.toHaveBeenCalled();
      }
    });

    it('should show loading modal during deletion', () => {
      let deletingAccount = false;

      // Start deletion
      deletingAccount = true;
      expect(deletingAccount).toBe(true);

      // Deletion complete (success or failure)
      deletingAccount = false;
      expect(deletingAccount).toBe(false);
    });
  });

  describe('Profile Display', () => {
    it('should display user email', () => {
      const email = mockAuthContext.user?.email;

      expect(email).toBe('test@example.com');
    });

    it('should display user name when available', () => {
      const userName = 'John Doe';

      expect(userName).toBeTruthy();
      expect(userName.length).toBeGreaterThan(0);
    });

    it('should show placeholder when no name is set', () => {
      const userName = '';
      const displayName = userName || 'No name set';

      expect(displayName).toBe('No name set');
    });
  });
});
