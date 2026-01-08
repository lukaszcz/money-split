const SCALE = 10000;

export function toScaled(amount: number): bigint {
  return BigInt(Math.round(amount * SCALE));
}

export function fromScaled(scaled: bigint | number): number {
  const val = typeof scaled === 'bigint' ? Number(scaled) : scaled;
  return val / SCALE;
}

export function formatCurrency(scaled: bigint | number, currencySymbol: string = ''): string {
  const val = typeof scaled === 'bigint' ? Number(scaled) : scaled;
  const decimal = (val / SCALE).toFixed(2);
  return currencySymbol ? `${currencySymbol}${decimal}` : decimal;
}

export function formatNumber(scaled: bigint | number): string {
  const val = typeof scaled === 'bigint' ? Number(scaled) : scaled;
  return (val / SCALE).toFixed(2);
}

export function multiplyScaled(a: bigint, b: bigint): bigint {
  return (a * b) / BigInt(SCALE);
}

export function divideScaled(dividend: bigint, divisor: number): bigint {
  return dividend / BigInt(divisor);
}

export function calculateEqualSplit(totalScaled: bigint, participantCount: number): bigint[] {
  if (participantCount <= 0) return [];

  const baseShare = totalScaled / BigInt(participantCount);
  const remainder = totalScaled - baseShare * BigInt(participantCount);

  const shares: bigint[] = [];
  for (let i = 0; i < participantCount; i++) {
    shares.push(baseShare);
  }

  let remainingUnits = remainder;
  let i = 0;
  while (remainingUnits > BigInt(0) && i < shares.length) {
    shares[i] += BigInt(1);
    remainingUnits -= BigInt(1);
    i++;
  }

  return shares;
}

export class ScaledPercentage {
  readonly percent4dp: number;

  constructor(percent: number) {
    this.percent4dp = Math.round(percent * SCALE);
  }

  calculateShare(totalScaled: bigint): bigint {
    const denominator = BigInt(100 * SCALE);
    return (totalScaled * BigInt(this.percent4dp)) / denominator;
  }

  toNumber(): number {
    return this.percent4dp / SCALE;
  }
}

export function calculatePercentageSplit(totalScaled: bigint, percentages: number[]): bigint[] {
  if (percentages.length === 0) return [];

  const scaledPercentages = percentages.map(p => new ScaledPercentage(p));
  const shares = scaledPercentages.map(sp => sp.calculateShare(totalScaled));

  const remainder = totalScaled - shares.reduce((a, b) => a + b, BigInt(0));

  let remainingUnits = remainder;
  let i = 0;
  while (remainingUnits > BigInt(0) && i < shares.length) {
    shares[i] += BigInt(1);
    remainingUnits -= BigInt(1);
    i++;
  }

  return shares;
}

export function normalizeExactSplit(sharesScaled: bigint[], totalScaled: bigint): bigint[] {
  if (sharesScaled.length === 0) return [];

  const sum = sharesScaled.reduce((a, b) => a + b, BigInt(0));
  const diff = totalScaled - sum;

  if (diff === BigInt(0)) {
    return sharesScaled;
  }

  const adjusted = [...sharesScaled];

  if (diff > BigInt(0)) {
    let remaining = diff;
    let i = 0;
    while (remaining > BigInt(0) && i < adjusted.length) {
      adjusted[i] += BigInt(1);
      remaining -= BigInt(1);
      i++;
    }
  } else {
    let remaining = -diff;
    let i = adjusted.length - 1;
    while (remaining > BigInt(0) && i >= 0) {
      if (adjusted[i] > BigInt(0)) {
        adjusted[i] -= BigInt(1);
        remaining -= BigInt(1);
      }
      i--;
    }
  }

  return adjusted;
}

export function sumScaled(values: (bigint | number)[]): bigint {
  return values.reduce((sum: bigint, val) => {
    const v = typeof val === 'bigint' ? val : BigInt(val);
    return sum + v;
  }, BigInt(0));
}

export function applyExchangeRate(valueScaled: bigint, rateScaled: bigint): bigint {
  return multiplyScaled(valueScaled, rateScaled);
}
