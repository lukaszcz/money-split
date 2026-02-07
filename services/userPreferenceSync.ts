import { refreshCurrencyOrderForUser } from './currencyPreferenceService';
import { prefetchExchangeRatesOnLogin } from './exchangeRateService';
import { refreshGroupPreferencesForUser } from './groupPreferenceService';
import { refreshSettlePreferenceForUser } from './settlePreferenceService';

export async function syncUserPreferences(userId: string): Promise<void> {
  await Promise.all([
    refreshCurrencyOrderForUser(userId),
    refreshGroupPreferencesForUser(userId),
    refreshSettlePreferenceForUser(userId),
    prefetchExchangeRatesOnLogin(),
  ]);
}
