import {
  getCurrencySymbol,
  getCurrencyName,
  CURRENCIES,
  Currency,
} from '../utils/currencies';

describe('getCurrencySymbol', () => {
  it('should return correct symbol for known currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('CNY')).toBe('¥');
    expect(getCurrencySymbol('INR')).toBe('₹');
  });

  it('should return symbol for currencies with duplicate symbols', () => {
    expect(getCurrencySymbol('MXN')).toBe('$');
    expect(getCurrencySymbol('BRL')).toBe('R$');
    expect(getCurrencySymbol('KRW')).toBe('₩');
    expect(getCurrencySymbol('SGD')).toBe('S$');
    expect(getCurrencySymbol('NZD')).toBe('NZ$');
  });

  it('should return code as fallback for unknown currency', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencySymbol('BTC')).toBe('BTC');
    expect(getCurrencySymbol('ETH')).toBe('ETH');
  });

  it('should be case-sensitive', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('usd')).toBe('usd');
    expect(getCurrencySymbol('Usd')).toBe('Usd');
  });
});

describe('getCurrencyName', () => {
  it('should return correct name for known currencies', () => {
    expect(getCurrencyName('USD')).toBe('US Dollar');
    expect(getCurrencyName('EUR')).toBe('Euro');
    expect(getCurrencyName('GBP')).toBe('British Pound');
    expect(getCurrencyName('JPY')).toBe('Japanese Yen');
    expect(getCurrencyName('INR')).toBe('Indian Rupee');
  });

  it('should return name for all supported currencies', () => {
    for (const currency of CURRENCIES) {
      const name = getCurrencyName(currency.code);
      expect(name).toBe(currency.name);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('should return code as fallback for unknown currency', () => {
    expect(getCurrencyName('XYZ')).toBe('XYZ');
    expect(getCurrencyName('BTC')).toBe('BTC');
    expect(getCurrencyName('ETH')).toBe('ETH');
  });

  it('should be case-sensitive', () => {
    expect(getCurrencyName('USD')).toBe('US Dollar');
    expect(getCurrencyName('usd')).toBe('usd');
    expect(getCurrencyName('Usd')).toBe('Usd');
  });
});

describe('CURRENCIES array', () => {
  it('should contain expected number of currencies', () => {
    expect(CURRENCIES.length).toBe(30);
  });

  it('should have all unique currency codes', () => {
    const codes = CURRENCIES.map(c => c.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('should have all required currency properties', () => {
    for (const currency of CURRENCIES) {
      expect(currency).toHaveProperty('code');
      expect(currency).toHaveProperty('name');
      expect(currency).toHaveProperty('symbol');
      expect(typeof currency.code).toBe('string');
      expect(typeof currency.name).toBe('string');
      expect(typeof currency.symbol).toBe('string');
    }
  });

  it('should have valid 3-letter ISO currency codes', () => {
    for (const currency of CURRENCIES) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('should have non-empty names', () => {
    for (const currency of CURRENCIES) {
      expect(currency.name.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty symbols', () => {
    for (const currency of CURRENCIES) {
      expect(currency.symbol.length).toBeGreaterThan(0);
    }
  });

  it('should include major world currencies', () => {
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'];
    const codes = CURRENCIES.map(c => c.code);

    for (const code of majorCurrencies) {
      expect(codes).toContain(code);
    }
  });

  it('should include currencies from different regions', () => {
    const codes = CURRENCIES.map(c => c.code);

    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
    expect(codes).toContain('JPY');
    expect(codes).toContain('BRL');
    expect(codes).toContain('ZAR');
    expect(codes).toContain('KRW');
  });
});

describe('Currency type', () => {
  it('should allow creating currency objects', () => {
    const currency: Currency = {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
    };

    expect(currency.code).toBe('USD');
    expect(currency.name).toBe('US Dollar');
    expect(currency.symbol).toBe('$');
  });

  it('should handle special characters in symbols', () => {
    const currenciesWithSpecialSymbols: Currency[] = [
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
      { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
      { code: 'THB', name: 'Thai Baht', symbol: '฿' },
      { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
    ];

    for (const currency of currenciesWithSpecialSymbols) {
      expect(currency.symbol.length).toBeGreaterThan(0);
      expect(currency.symbol).not.toBe(currency.code);
    }
  });
});

describe('Currency lookup consistency', () => {
  it('should return consistent symbol for multiple lookups', () => {
    const code = 'USD';
    const symbol1 = getCurrencySymbol(code);
    const symbol2 = getCurrencySymbol(code);
    const symbol3 = getCurrencySymbol(code);

    expect(symbol1).toBe(symbol2);
    expect(symbol2).toBe(symbol3);
  });

  it('should return consistent name for multiple lookups', () => {
    const code = 'EUR';
    const name1 = getCurrencyName(code);
    const name2 = getCurrencyName(code);
    const name3 = getCurrencyName(code);

    expect(name1).toBe(name2);
    expect(name2).toBe(name3);
  });

  it('should have matching symbol between direct lookup and CURRENCIES array', () => {
    for (const currency of CURRENCIES) {
      const symbol = getCurrencySymbol(currency.code);
      expect(symbol).toBe(currency.symbol);
    }
  });

  it('should have matching name between direct lookup and CURRENCIES array', () => {
    for (const currency of CURRENCIES) {
      const name = getCurrencyName(currency.code);
      expect(name).toBe(currency.name);
    }
  });
});
