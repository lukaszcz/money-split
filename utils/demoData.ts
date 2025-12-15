/**
 * Demo data initialization helper
 * Creates sample users, groups, and expenses for testing
 */

import { createUser, createGroup, createExpense, getAllUsers } from '../services/groupRepository';
import { toScaled, calculateEqualSplit, applyExchangeRate } from './money';
import { getExchangeRate } from '../services/exchangeRateService';

export async function initializeDemoData(): Promise<boolean> {
  try {
    const existingUsers = await getAllUsers();
    if (existingUsers.length > 0) {
      return false;
    }

    const alice = await createUser('Alice', 'alice@example.com');
    const bob = await createUser('Bob', 'bob@example.com');
    const charlie = await createUser('Charlie', 'charlie@example.com');

    if (!alice || !bob || !charlie) {
      console.error('Failed to create demo users');
      return false;
    }

    const tripGroup = await createGroup('Trip to Paris', 'EUR', [alice.id, bob.id, charlie.id]);

    if (!tripGroup) {
      console.error('Failed to create demo group');
      return false;
    }

    const rate = await getExchangeRate('EUR', 'EUR');
    if (!rate) return false;

    const totalScaled = toScaled(150);
    const shares = calculateEqualSplit(totalScaled, 3);

    await createExpense(
      tripGroup.id,
      'Hotel booking',
      new Date().toISOString(),
      'EUR',
      totalScaled,
      alice.id,
      rate.rateScaled,
      totalScaled,
      [
        { userId: alice.id, shareAmountScaled: shares[0], shareInMainScaled: shares[0] },
        { userId: bob.id, shareAmountScaled: shares[1], shareInMainScaled: shares[1] },
        { userId: charlie.id, shareAmountScaled: shares[2], shareInMainScaled: shares[2] },
      ]
    );

    console.log('Demo data initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize demo data:', error);
    return false;
  }
}
