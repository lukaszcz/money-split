import { User, GroupMember, Group, Expense, ExpenseShare } from '../../services/groupRepository';

export const mockUsers = {
  alice: {
    id: 'user-alice',
    name: 'Alice',
    email: 'alice@example.com',
    createdAt: '2024-01-01T00:00:00Z',
  } as User,
  bob: {
    id: 'user-bob',
    name: 'Bob',
    email: 'bob@example.com',
    createdAt: '2024-01-01T00:00:00Z',
  } as User,
  charlie: {
    id: 'user-charlie',
    name: 'Charlie',
    email: 'charlie@example.com',
    createdAt: '2024-01-01T00:00:00Z',
  } as User,
};

export const mockGroups = {
  trip: {
    id: 'group-trip',
    name: 'Weekend Trip',
    mainCurrencyCode: 'USD',
    createdAt: '2024-01-01T00:00:00Z',
  } as Group,
  apartment: {
    id: 'group-apartment',
    name: 'Apartment',
    mainCurrencyCode: 'EUR',
    createdAt: '2024-01-02T00:00:00Z',
  } as Group,
};

export const mockMembers = {
  aliceInTrip: {
    id: 'member-alice-trip',
    groupId: 'group-trip',
    name: 'Alice',
    email: 'alice@example.com',
    connectedUserId: 'user-alice',
    createdAt: '2024-01-01T00:00:00Z',
  } as GroupMember,
  bobInTrip: {
    id: 'member-bob-trip',
    groupId: 'group-trip',
    name: 'Bob',
    email: 'bob@example.com',
    connectedUserId: 'user-bob',
    createdAt: '2024-01-01T00:00:00Z',
  } as GroupMember,
  charlieInTrip: {
    id: 'member-charlie-trip',
    groupId: 'group-trip',
    name: 'Charlie',
    email: 'charlie@example.com',
    connectedUserId: 'user-charlie',
    createdAt: '2024-01-01T00:00:00Z',
  } as GroupMember,
  unconnectedInTrip: {
    id: 'member-unconnected-trip',
    groupId: 'group-trip',
    name: 'Dave',
    email: 'dave@example.com',
    connectedUserId: undefined,
    createdAt: '2024-01-01T00:00:00Z',
  } as GroupMember,
};

export const mockExpenses = {
  dinner: {
    id: 'expense-dinner',
    groupId: 'group-trip',
    description: 'Dinner at restaurant',
    dateTime: '2024-01-15T19:00:00Z',
    currencyCode: 'USD',
    totalAmountScaled: BigInt(120000), // $12.00
    payerMemberId: 'member-alice-trip',
    exchangeRateToMainScaled: BigInt(10000), // 1:1
    totalInMainScaled: BigInt(120000),
    createdAt: '2024-01-15T20:00:00Z',
    paymentType: 'expense' as const,
    splitType: 'equal' as const,
    shares: [
      {
        id: 'share-1',
        memberId: 'member-alice-trip',
        shareAmountScaled: BigInt(40000),
        shareInMainScaled: BigInt(40000),
      },
      {
        id: 'share-2',
        memberId: 'member-bob-trip',
        shareAmountScaled: BigInt(40000),
        shareInMainScaled: BigInt(40000),
      },
      {
        id: 'share-3',
        memberId: 'member-charlie-trip',
        shareAmountScaled: BigInt(40000),
        shareInMainScaled: BigInt(40000),
      },
    ] as ExpenseShare[],
  } as Expense,
  transfer: {
    id: 'expense-transfer',
    groupId: 'group-trip',
    description: 'Payment from Bob to Alice',
    dateTime: '2024-01-16T10:00:00Z',
    currencyCode: 'USD',
    totalAmountScaled: BigInt(50000), // $5.00
    payerMemberId: 'member-bob-trip',
    exchangeRateToMainScaled: BigInt(10000), // 1:1
    totalInMainScaled: BigInt(50000),
    createdAt: '2024-01-16T10:00:00Z',
    paymentType: 'transfer' as const,
    splitType: 'exact' as const,
    shares: [
      {
        id: 'share-4',
        memberId: 'member-alice-trip',
        shareAmountScaled: BigInt(50000),
        shareInMainScaled: BigInt(50000),
      },
    ] as ExpenseShare[],
  } as Expense,
};

export function createMockDatabaseRow(obj: any): any {
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = obj[key];
    if (typeof value === 'bigint') {
      result[snakeKey] = Number(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}
