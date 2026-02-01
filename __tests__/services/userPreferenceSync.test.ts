import { syncUserPreferences } from '@/services/userPreferenceSync';

jest.mock('@/services/currencyPreferenceService', () => ({
  refreshCurrencyOrderForUser: jest.fn(),
}));

jest.mock('@/services/groupPreferenceService', () => ({
  refreshGroupPreferencesForUser: jest.fn(),
}));

jest.mock('@/services/settlePreferenceService', () => ({
  refreshSettlePreferenceForUser: jest.fn(),
}));

describe('userPreferenceSync', () => {
  it('refreshes all user preferences in parallel', async () => {
    const currencyService = require('@/services/currencyPreferenceService');
    const groupService = require('@/services/groupPreferenceService');
    const settleService = require('@/services/settlePreferenceService');

    await syncUserPreferences('user-123');

    expect(currencyService.refreshCurrencyOrderForUser).toHaveBeenCalledWith(
      'user-123',
    );
    expect(groupService.refreshGroupPreferencesForUser).toHaveBeenCalledWith(
      'user-123',
    );
    expect(settleService.refreshSettlePreferenceForUser).toHaveBeenCalledWith(
      'user-123',
    );
  });
});
