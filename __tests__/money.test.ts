import {
  toScaled,
  fromScaled,
  formatCurrency,
  formatNumber,
  multiplyScaled,
  divideScaled,
  calculateEqualSplit,
  ScaledPercentage,
  calculatePercentageSplit,
  sumScaled,
  applyExchangeRate,
} from '../utils/money';

describe('toScaled', () => {
  it('should scale integer amounts correctly', () => {
    expect(toScaled(1)).toBe(BigInt(10000));
    expect(toScaled(100)).toBe(BigInt(1000000));
  });

  it('should scale decimal amounts with 4 decimal places', () => {
    expect(toScaled(0.0001)).toBe(BigInt(1));
    expect(toScaled(0.1234)).toBe(BigInt(1234));
    expect(toScaled(1.2345)).toBe(BigInt(12345));
    expect(toScaled(12.3456)).toBe(BigInt(123456));
  });

  it('should round to nearest integer after scaling', () => {
    expect(toScaled(0.00005)).toBe(BigInt(1));
    expect(toScaled(1.23455)).toBe(BigInt(12346));
    expect(toScaled(1.23454)).toBe(BigInt(12345));
  });
});

describe('fromScaled', () => {
  it('should convert bigint scaled values back to decimal', () => {
    expect(fromScaled(BigInt(0))).toBe(0);
    expect(fromScaled(BigInt(10000))).toBe(1);
    expect(fromScaled(BigInt(1000000))).toBe(100);
  });

  it('should convert precise decimal values', () => {
    expect(fromScaled(BigInt(1))).toBe(0.0001);
    expect(fromScaled(BigInt(1234))).toBe(0.1234);
    expect(fromScaled(BigInt(12345))).toBe(1.2345);
  });

  it('should handle number input', () => {
    expect(fromScaled(10000)).toBe(1);
    expect(fromScaled(1234)).toBe(0.1234);
  });
});

describe('formatCurrency', () => {
  it('should format without currency symbol', () => {
    expect(formatCurrency(BigInt(10000))).toBe('1.00');
    expect(formatCurrency(BigInt(12345))).toBe('1.23');
    expect(formatCurrency(BigInt(123456))).toBe('12.35');
  });

  it('should format with currency symbol', () => {
    expect(formatCurrency(BigInt(10000), '$')).toBe('$1.00');
    expect(formatCurrency(BigInt(12345), '€')).toBe('€1.23');
    expect(formatCurrency(BigInt(123456), '£')).toBe('£12.35');
  });

  it('should handle number input', () => {
    expect(formatCurrency(10000, '$')).toBe('$1.00');
    expect(formatCurrency(12345, '€')).toBe('€1.23');
  });

  it('should handle zero', () => {
    expect(formatCurrency(BigInt(0), '$')).toBe('$0.00');
    expect(formatCurrency(BigInt(0))).toBe('0.00');
  });
});

describe('formatNumber', () => {
  it('should format scaled values as 2 decimal places', () => {
    expect(formatNumber(BigInt(10000))).toBe('1.00');
    expect(formatNumber(BigInt(12345))).toBe('1.23');
    expect(formatNumber(BigInt(123456))).toBe('12.35');
  });

  it('should handle number input', () => {
    expect(formatNumber(10000)).toBe('1.00');
    expect(formatNumber(12345)).toBe('1.23');
  });

  it('should handle zero', () => {
    expect(formatNumber(BigInt(0))).toBe('0.00');
  });

  it('should handle negative values', () => {
    expect(formatNumber(BigInt(-10000))).toBe('-1.00');
  });
});

describe('multiplyScaled', () => {
  it('should multiply scaled values correctly', () => {
    const a = BigInt(10000);
    const b = BigInt(20000);
    expect(multiplyScaled(a, b)).toBe(BigInt(20000));
  });

  it('should handle decimal multiplication', () => {
    const a = toScaled(1.5);
    const b = toScaled(2.5);
    expect(multiplyScaled(a, b)).toBe(BigInt(37500));
  });
});

describe('divideScaled', () => {
  it('should divide scaled value by integer divisor', () => {
    const dividend = BigInt(20000);
    expect(divideScaled(dividend, 2)).toBe(BigInt(10000));
  });

  it('should handle division with rounding down', () => {
    const dividend = BigInt(20001);
    expect(divideScaled(dividend, 2)).toBe(BigInt(10000));
  });

  it('should handle zero dividend', () => {
    expect(divideScaled(BigInt(0), 5)).toBe(BigInt(0));
  });

  it('should handle negative values', () => {
    const dividend = BigInt(-20000);
    expect(divideScaled(dividend, 2)).toBe(BigInt(-10000));
  });
});

describe('calculateEqualSplit', () => {
  it('should split evenly without remainder', () => {
    const total = BigInt(30000);
    const shares = calculateEqualSplit(total, 3);
    expect(shares).toEqual([BigInt(10000), BigInt(10000), BigInt(10000)]);
  });

  it('should distribute remainder to first shares', () => {
    const total = BigInt(31000);
    const shares = calculateEqualSplit(total, 3);
    expect(shares[0]).toBe(BigInt(10334));
    expect(shares[1]).toBe(BigInt(10333));
    expect(shares[2]).toBe(BigInt(10333));
  });

  it('should handle zero total', () => {
    const shares = calculateEqualSplit(BigInt(0), 3);
    expect(shares).toEqual([BigInt(0), BigInt(0), BigInt(0)]);
  });

  it('should handle single participant', () => {
    const total = BigInt(12345);
    const shares = calculateEqualSplit(total, 1);
    expect(shares).toEqual([BigInt(12345)]);
  });

  it('should sum to total', () => {
    const total = BigInt(45678);
    const shares = calculateEqualSplit(total, 7);
    const sum = shares.reduce((a, b) => a + b, BigInt(0));
    expect(sum).toBe(total);
  });
});

describe('ScaledPercentage', () => {
  it('should create and store percentage', () => {
    const sp = new ScaledPercentage(50);
    expect(sp.toNumber()).toBe(50);
  });

  it('should handle decimal percentages', () => {
    const sp = new ScaledPercentage(12.3456);
    expect(sp.toNumber()).toBe(12.3456);
  });

  it('should round percentage to 4 decimal places', () => {
    const sp = new ScaledPercentage(12.34556);
    expect(sp.toNumber()).toBe(12.3456);
  });

  it('should calculate share correctly', () => {
    const sp = new ScaledPercentage(50);
    const total = BigInt(10000);
    expect(sp.calculateShare(total)).toBe(BigInt(5000));
  });

  it('should calculate share with decimal percentage', () => {
    const sp = new ScaledPercentage(33.3333);
    const total = BigInt(10000);
    expect(sp.calculateShare(total)).toBe(BigInt(3333));
  });

  it('should calculate zero share for 0%', () => {
    const sp = new ScaledPercentage(0);
    const total = BigInt(10000);
    expect(sp.calculateShare(total)).toBe(BigInt(0));
  });

  it('should calculate full share for 100%', () => {
    const sp = new ScaledPercentage(100);
    const total = BigInt(10000);
    expect(sp.calculateShare(total)).toBe(BigInt(10000));
  });
});

describe('calculatePercentageSplit', () => {
  it('should split by exact percentages', () => {
    const total = BigInt(10000);
    const shares = calculatePercentageSplit(total, [50, 50]);
    expect(shares).toEqual([BigInt(5000), BigInt(5000)]);
  });

  it('should split by multiple percentages', () => {
    const total = BigInt(10000);
    const shares = calculatePercentageSplit(total, [25, 25, 25, 25]);
    expect(shares).toEqual([BigInt(2500), BigInt(2500), BigInt(2500), BigInt(2500)]);
  });

  it('should handle uneven percentages', () => {
    const total = BigInt(10000);
    const shares = calculatePercentageSplit(total, [60, 40]);
    expect(shares).toEqual([BigInt(6000), BigInt(4000)]);
  });

  it('should distribute remainder to first shares', () => {
    const total = BigInt(10000);
    const shares = calculatePercentageSplit(total, [33.3333, 66.6667]);
    expect(shares[0]).toBe(BigInt(3334));
    expect(shares[1]).toBe(BigInt(6666));
    expect(shares.reduce((a, b) => a + b, BigInt(0))).toBe(total);
  });

  it('should return empty array for no percentages', () => {
    const shares = calculatePercentageSplit(BigInt(10000), []);
    expect(shares).toEqual([]);
  });

  it('should handle zero total', () => {
    const shares = calculatePercentageSplit(BigInt(0), [50, 50]);
    expect(shares).toEqual([BigInt(0), BigInt(0)]);
  });

  it('should sum to total', () => {
    const total = BigInt(45678);
    const shares = calculatePercentageSplit(total, [30, 40, 30]);
    const sum = shares.reduce((a, b) => a + b, BigInt(0));
    expect(sum).toBe(total);
  });
});

describe('sumScaled', () => {
  it('should sum bigint values', () => {
    const values = [BigInt(10000), BigInt(20000), BigInt(30000)];
    expect(sumScaled(values)).toBe(BigInt(60000));
  });

  it('should sum mixed bigint and number values', () => {
    const values = [BigInt(10000), 20000, BigInt(30000)];
    expect(sumScaled(values)).toBe(BigInt(60000));
  });

  it('should sum to zero for empty array', () => {
    expect(sumScaled([])).toBe(BigInt(0));
  });

  it('should sum single value', () => {
    expect(sumScaled([BigInt(10000)])).toBe(BigInt(10000));
  });

  it('should handle negative values', () => {
    const values = [BigInt(10000), BigInt(-5000), BigInt(3000)];
    expect(sumScaled(values)).toBe(BigInt(8000));
  });

  it('should sum number values', () => {
    const values = [10000, 20000, 30000];
    expect(sumScaled(values)).toBe(BigInt(60000));
  });
});

describe('applyExchangeRate', () => {
  it('should apply exchange rate correctly', () => {
    const value = toScaled(100);
    const rate = toScaled(1.5);
    expect(applyExchangeRate(value, rate)).toBe(BigInt(1500000));
  });

  it('should convert between currencies', () => {
    const usd = toScaled(100);
    const rate = toScaled(0.85);
    const eur = applyExchangeRate(usd, rate);
    expect(eur).toBe(BigInt(850000));
  });

  it('should handle zero value', () => {
    expect(applyExchangeRate(BigInt(0), toScaled(1.5))).toBe(BigInt(0));
  });

  it('should handle rate of 1', () => {
    const value = toScaled(100);
    const rate = toScaled(1);
    expect(applyExchangeRate(value, rate)).toBe(BigInt(1000000));
  });
});
