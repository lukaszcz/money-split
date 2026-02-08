import { requestPasswordRecovery } from '@/services/authService';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('authService', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPasswordRecovery', () => {
    it('invokes password-recovery function with email payload', async () => {
      mockInvoke.mockResolvedValue({ error: null });

      await requestPasswordRecovery('test@example.com');

      expect(mockInvoke).toHaveBeenCalledWith('password-recovery', {
        body: { email: 'test@example.com' },
      });
    });

    it('throws when password-recovery invocation returns error', async () => {
      const invocationError = new Error('Failed to send recovery email');
      mockInvoke.mockResolvedValue({ error: invocationError });

      await expect(requestPasswordRecovery('test@example.com')).rejects.toBe(
        invocationError,
      );
    });
  });
});
