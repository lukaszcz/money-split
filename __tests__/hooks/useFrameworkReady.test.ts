/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFrameworkReady } from '../../hooks/useFrameworkReady';

describe('useFrameworkReady', () => {
  it('calls window.frameworkReady when available', async () => {
    const readySpy = jest.fn();
    window.frameworkReady = readySpy;

    renderHook(() => useFrameworkReady());

    await waitFor(() => {
      expect(readySpy).toHaveBeenCalledTimes(1);
    });
  });

  it('does not throw when frameworkReady is missing', () => {
    window.frameworkReady = undefined;

    expect(() => {
      renderHook(() => useFrameworkReady());
    }).not.toThrow();
  });
});
