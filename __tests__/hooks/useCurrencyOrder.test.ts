import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCurrencyOrder } from '../../hooks/useCurrencyOrder';
import { CURRENCIES } from '../../utils/currencies';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserCurrencyOrder,
  updateCurrencyOrder,
  ensureGroupCurrencyInOrder,
} from '@/services/currencyPreferenceService';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/currencyPreferenceService', () => ({
  getUserCurrencyOrder: jest.fn(),
  updateCurrencyOrder: jest.fn(),
  ensureGroupCurrencyInOrder: jest.fn(),
}));

const getCurrenciesByCodes = (codes: string[]) =>
  codes
    .map((code) => CURRENCIES.find((currency) => currency.code === code))
    .filter((currency): currency is (typeof CURRENCIES)[number] =>
      Boolean(currency),
    );

describe('useCurrencyOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default currencies when user is not signed in', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCurrencyOrder());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.currencies).toEqual(CURRENCIES);
    expect(getUserCurrencyOrder).not.toHaveBeenCalled();
    expect(ensureGroupCurrencyInOrder).not.toHaveBeenCalled();
  });

  it('loads ordered currencies for the signed-in user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-123' } });
    (ensureGroupCurrencyInOrder as jest.Mock).mockResolvedValue(undefined);
    (getUserCurrencyOrder as jest.Mock).mockResolvedValue([
      'EUR',
      'USD',
      'UNKNOWN',
    ]);

    const { result } = renderHook(() => useCurrencyOrder('GBP'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(ensureGroupCurrencyInOrder).toHaveBeenCalledWith('GBP');
    expect(getUserCurrencyOrder).toHaveBeenCalled();
    expect(result.current.currencies).toEqual(
      getCurrenciesByCodes(['EUR', 'USD']),
    );
  });

  it('updates the order when selecting a currency', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-123' } });
    (updateCurrencyOrder as jest.Mock).mockResolvedValue(undefined);
    (getUserCurrencyOrder as jest.Mock)
      .mockResolvedValueOnce(['USD', 'EUR'])
      .mockResolvedValueOnce(['JPY', 'USD']);

    const { result } = renderHook(() => useCurrencyOrder());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectCurrency('JPY');
    });

    await waitFor(() => {
      expect(result.current.currencies).toEqual(
        getCurrenciesByCodes(['JPY', 'USD']),
      );
    });

    expect(updateCurrencyOrder).toHaveBeenCalledWith('JPY');
    expect(getUserCurrencyOrder).toHaveBeenCalledTimes(2);
  });

  it('does nothing when selecting a currency without a user', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCurrencyOrder());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.selectCurrency('USD');
    });

    expect(updateCurrencyOrder).not.toHaveBeenCalled();
    expect(getUserCurrencyOrder).not.toHaveBeenCalled();
  });
});
