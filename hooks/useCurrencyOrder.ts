import { useState, useEffect, useCallback } from 'react';
import { Currency, CURRENCIES } from '@/utils/currencies';
import { getUserCurrencyOrder, updateCurrencyOrder, ensureGroupCurrencyInOrder } from '@/services/currencyPreferenceService';
import { useAuth } from '@/contexts/AuthContext';

export function useCurrencyOrder(groupCurrency?: string) {
  const { user } = useAuth();
  const [orderedCurrencies, setOrderedCurrencies] = useState<Currency[]>(CURRENCIES);
  const [loading, setLoading] = useState(true);

  const loadCurrencyOrder = useCallback(async () => {
    try {
      setLoading(true);

      if (groupCurrency) {
        await ensureGroupCurrencyInOrder(groupCurrency);
      }

      const currencyOrder = await getUserCurrencyOrder();

      const ordered = currencyOrder
        .map(code => CURRENCIES.find(c => c.code === code))
        .filter((c): c is Currency => c !== undefined);

      setOrderedCurrencies(ordered);
    } catch (error) {
      console.error('Error loading currency order:', error);
      setOrderedCurrencies(CURRENCIES);
    } finally {
      setLoading(false);
    }
  }, [groupCurrency]);

  useEffect(() => {
    if (user) {
      loadCurrencyOrder();
    } else {
      setOrderedCurrencies(CURRENCIES);
      setLoading(false);
    }
  }, [user, loadCurrencyOrder]);

  const selectCurrency = useCallback(async (currencyCode: string) => {
    if (!user) {
      return;
    }

    try {
      await updateCurrencyOrder(currencyCode);

      const currencyOrder = await getUserCurrencyOrder();
      const ordered = currencyOrder
        .map(code => CURRENCIES.find(c => c.code === code))
        .filter((c): c is Currency => c !== undefined);

      setOrderedCurrencies(ordered);
    } catch (error) {
      console.error('Error updating currency order:', error);
    }
  }, [user]);

  return {
    currencies: orderedCurrencies,
    loading,
    selectCurrency,
    refreshOrder: loadCurrencyOrder,
  };
}
