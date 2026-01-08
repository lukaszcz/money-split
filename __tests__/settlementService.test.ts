import {
  computeBalances,
  computeSettlementsNoSimplify,
  computeSettlementsSimplified,
  computeSimplificationSteps,
  Settlement,
} from '../services/settlementService';
import { Expense, GroupMember } from '../services/groupRepository';

describe('computeBalances', () => {
  const createMember = (id: string, name: string): GroupMember => ({
    id,
    groupId: 'group-1',
    name,
    createdAt: new Date().toISOString(),
  });

  it('should return zero balances for no expenses', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];
    const balances = computeBalances([], members);

    expect(balances.size).toBe(3);
    expect(balances.get('m1')).toBe(BigInt(0));
    expect(balances.get('m2')).toBe(BigInt(0));
    expect(balances.get('m3')).toBe(BigInt(0));
  });

  it('should calculate correct balances for single expense', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expense: Expense = {
      id: 'e1',
      groupId: 'group-1',
      description: 'Dinner',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(100000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(100000),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(33334), shareInMainScaled: BigInt(33334) },
        { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(33333), shareInMainScaled: BigInt(33333) },
        { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(33333), shareInMainScaled: BigInt(33333) },
      ],
    };

    const balances = computeBalances([expense], members);

    expect(balances.get('m1')).toBe(BigInt(66666));
    expect(balances.get('m2')).toBe(BigInt(-33333));
    expect(balances.get('m3')).toBe(BigInt(-33333));
  });

  it('should handle payer who is also a participant', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expense: Expense = {
      id: 'e1',
      groupId: 'group-1',
      description: 'Lunch',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(100000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(100000),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
      ],
    };

    const balances = computeBalances([expense], members);

    expect(balances.get('m1')).toBe(BigInt(50000));
    expect(balances.get('m2')).toBe(BigInt(-50000));
  });

  it('should sum balances across multiple expenses', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expense1: Expense = {
      id: 'e1',
      groupId: 'group-1',
      description: 'Dinner',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(90000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(90000),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
        { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
        { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
      ],
    };

    const expense2: Expense = {
      id: 'e2',
      groupId: 'group-1',
      description: 'Lunch',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(60000),
      payerMemberId: 'm2',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(60000),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's4', memberId: 'm1', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
        { id: 's5', memberId: 'm2', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
        { id: 's6', memberId: 'm3', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
      ],
    };

    const balances = computeBalances([expense1, expense2], members);

    expect(balances.get('m1')).toBe(BigInt(40000));
    expect(balances.get('m2')).toBe(BigInt(10000));
    expect(balances.get('m3')).toBe(BigInt(-50000));
  });

  it('should handle zero amount expenses', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expense: Expense = {
      id: 'e1',
      groupId: 'group-1',
      description: 'Free dinner',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(0),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(0),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(0), shareInMainScaled: BigInt(0) },
        { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(0), shareInMainScaled: BigInt(0) },
      ],
    };

    const balances = computeBalances([expense], members);

    expect(balances.get('m1')).toBe(BigInt(0));
    expect(balances.get('m2')).toBe(BigInt(0));
  });

  it('should handle negative amounts (transfers)', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expense: Expense = {
      id: 'e1',
      groupId: 'group-1',
      description: 'Transfer',
      dateTime: new Date().toISOString(),
      currencyCode: 'USD',
      totalAmountScaled: BigInt(-100000),
      payerMemberId: 'm1',
      exchangeRateToMainScaled: BigInt(10000),
      totalInMainScaled: BigInt(-100000),
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(-100000), shareInMainScaled: BigInt(-100000) },
      ],
    };

    const balances = computeBalances([expense], members);

    expect(balances.get('m1')).toBe(BigInt(0));
    expect(balances.get('m2')).toBe(BigInt(0));
  });

  it('should sum all member balances to zero', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
      createMember('m4', 'Dave'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(25000), shareInMainScaled: BigInt(25000) },
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(25000), shareInMainScaled: BigInt(25000) },
          { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(25000), shareInMainScaled: BigInt(25000) },
          { id: 's4', memberId: 'm4', shareAmountScaled: BigInt(25000), shareInMainScaled: BigInt(25000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(200000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(200000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's5', memberId: 'm1', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
          { id: 's6', memberId: 'm2', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
          { id: 's7', memberId: 'm3', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
          { id: 's8', memberId: 'm4', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        ],
      },
    ];

    const balances = computeBalances(expenses, members);
    const totalBalance = Array.from(balances.values()).reduce((sum, balance) => sum + balance, BigInt(0));

    expect(totalBalance).toBe(BigInt(0));
  });
});

describe('computeSettlementsNoSimplify', () => {
  const createMember = (id: string, name: string): GroupMember => ({
    id,
    groupId: 'group-1',
    name,
    createdAt: new Date().toISOString(),
  });

  it('should return empty settlements for no expenses', () => {
    const members = [createMember('m1', 'Alice'), createMember('m2', 'Bob')];
    const settlements = computeSettlementsNoSimplify([], members);

    expect(settlements.length).toBe(0);
  });

  it('should create direct settlements for simple expense', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(90000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(90000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
          { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
        ],
      },
    ];

    const settlements = computeSettlementsNoSimplify(expenses, members);

    expect(settlements.length).toBe(2);
    expect(settlements[0].from.id).toBe('m2');
    expect(settlements[0].to.id).toBe('m1');
    expect(settlements[0].amountScaled).toBe(BigInt(30000));
    expect(settlements[1].from.id).toBe('m3');
    expect(settlements[1].to.id).toBe('m1');
    expect(settlements[1].amountScaled).toBe(BigInt(30000));
  });

  it('should handle opposite debts by canceling them', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(50000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(50000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm1', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        ],
      },
    ];

    const settlements = computeSettlementsNoSimplify(expenses, members);

    expect(settlements.length).toBe(1);
    expect(settlements[0].from.id).toBe('m2');
    expect(settlements[0].to.id).toBe('m1');
    expect(settlements[0].amountScaled).toBe(BigInt(50000));
  });

  it('should fully cancel equal opposite debts', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm1', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
    ];

    const settlements = computeSettlementsNoSimplify(expenses, members);

    expect(settlements.length).toBe(0);
  });

  it('should merge settlements between same people', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(50000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(50000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(60000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(60000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
        ],
      },
    ];

    const settlements = computeSettlementsNoSimplify(expenses, members);

    expect(settlements.length).toBe(1);
    expect(settlements[0].from.id).toBe('m2');
    expect(settlements[0].to.id).toBe('m1');
    expect(settlements[0].amountScaled).toBe(BigInt(110000));
  });

  it('should handle complex multiple expense scenarios', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(120000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(120000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
          { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(60000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(60000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's4', memberId: 'm1', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
          { id: 's5', memberId: 'm2', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
          { id: 's6', memberId: 'm3', shareAmountScaled: BigInt(20000), shareInMainScaled: BigInt(20000) },
        ],
      },
    ];

    const settlements = computeSettlementsNoSimplify(expenses, members);

    expect(settlements.length).toBeGreaterThan(0);

    const totalFromSettlements = settlements.reduce((total, settlement) => total + settlement.amountScaled, BigInt(0));
    const totalToSettlements = settlements.reduce((total, settlement) => total + settlement.amountScaled, BigInt(0));
    expect(totalFromSettlements).toBe(totalToSettlements);
  });
});

describe('computeSettlementsSimplified', () => {
  const createMember = (id: string, name: string): GroupMember => ({
    id,
    groupId: 'group-1',
    name,
    createdAt: new Date().toISOString(),
  });

  it('should return empty settlements when all balances are zero', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(0), shareInMainScaled: BigInt(0) },
        ],
      },
    ];

    const settlements = computeSettlementsSimplified(expenses, members);

    expect(settlements.length).toBe(0);
  });

  it('should create single settlement for simple debt', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
    ];

    const settlements = computeSettlementsSimplified(expenses, members);

    expect(settlements.length).toBe(1);
    expect(settlements[0].from.id).toBe('m2');
    expect(settlements[0].to.id).toBe('m1');
    expect(settlements[0].amountScaled).toBe(BigInt(100000));
  });

  it('should minimize number of transfers for multiple debts', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(120000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(120000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
          { id: 's2', memberId: 'm3', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
        ],
      },
    ];

    const settlements = computeSettlementsSimplified(expenses, members);

    expect(settlements.length).toBe(2);
    expect(settlements.every(s => s.amountScaled > BigInt(0))).toBe(true);

    const totalSettled = settlements.reduce((sum, s) => sum + s.amountScaled, BigInt(0));
    expect(totalSettled).toBe(BigInt(120000));
  });

  it('should handle complex multi-member settlements', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
      createMember('m4', 'Dave'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(400000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(400000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm1', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
          { id: 's2', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
          { id: 's3', memberId: 'm3', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
          { id: 's4', memberId: 'm4', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(225000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(225000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's5', memberId: 'm2', shareAmountScaled: BigInt(75000), shareInMainScaled: BigInt(75000) },
          { id: 's6', memberId: 'm3', shareAmountScaled: BigInt(75000), shareInMainScaled: BigInt(75000) },
          { id: 's7', memberId: 'm4', shareAmountScaled: BigInt(75000), shareInMainScaled: BigInt(75000) },
        ],
      },
    ];

    const settlements = computeSettlementsSimplified(expenses, members);
    const balances = computeBalances(expenses, members);

    const positiveBalances = Array.from(balances.entries())
      .filter(([_, balance]) => balance > BigInt(0))
      .map(([_, balance]) => balance)
      .reduce((sum, balance) => sum + balance, BigInt(0));

    const negativeBalances = Array.from(balances.entries())
      .filter(([_, balance]) => balance < BigInt(0))
      .map(([_, balance]) => -balance)
      .reduce((sum, balance) => sum + balance, BigInt(0));

    expect(positiveBalances).toBe(negativeBalances);

    const totalSettled = settlements.reduce((sum, s) => sum + s.amountScaled, BigInt(0));
    expect(totalSettled).toBe(positiveBalances);
  });

  it('should produce fewer settlements than non-simplified version', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(90000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(90000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(45000), shareInMainScaled: BigInt(45000) },
          { id: 's2', memberId: 'm3', shareAmountScaled: BigInt(45000), shareInMainScaled: BigInt(45000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(60000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(60000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's3', memberId: 'm1', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
          { id: 's4', memberId: 'm3', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
        ],
      },
    ];

    const simplified = computeSettlementsSimplified(expenses, members);
    const notSimplified = computeSettlementsNoSimplify(expenses, members);

    expect(simplified.length).toBeLessThanOrEqual(notSimplified.length);
  });

  it('should preserve total debt amount across settlements', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(120000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(120000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
          { id: 's2', memberId: 'm3', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
        ],
      },
    ];

    const settlements = computeSettlementsSimplified(expenses, members);
    const totalSettled = settlements.reduce((sum, s) => sum + s.amountScaled, BigInt(0));

    expect(totalSettled).toBe(BigInt(120000));
  });
});

describe('computeSimplificationSteps', () => {
  const createMember = (id: string, name: string): GroupMember => ({
    id,
    groupId: 'group-1',
    name,
    createdAt: new Date().toISOString(),
  });

  it('should return initial step for no expenses', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const steps = computeSimplificationSteps([], members);

    expect(steps.length).toBe(1);
    expect(steps[0].settlements.length).toBe(0);
    expect(steps[0].highlightedIndices.length).toBe(0);
    expect(steps[0].resultIndices.length).toBe(0);
  });

  it('should return initial step when no simplification possible', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
    ];

    const steps = computeSimplificationSteps(expenses, members);

    expect(steps.length).toBe(1);
    expect(steps[0].settlements.length).toBe(1);
  });

  it('should show simplification steps for opposite debts', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(50000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(50000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm1', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        ],
      },
    ];

    const steps = computeSimplificationSteps(expenses, members);

    expect(steps.length).toBeGreaterThan(1);

    const lastStep = steps[steps.length - 1];
    expect(lastStep.settlements.length).toBe(1);
    expect(lastStep.settlements[0].amountScaled).toBe(BigInt(50000));
  });

  it('should show multiple steps for chain simplifications', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm3', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
    ];

    const steps = computeSimplificationSteps(expenses, members);

    expect(steps.length).toBeGreaterThan(2);

    const firstStep = steps[0];
    expect(firstStep.settlements.length).toBe(2);

    const lastStep = steps[steps.length - 1];
    expect(lastStep.settlements.length).toBe(1);
    expect(lastStep.settlements[0].from.id).toBe('m3');
    expect(lastStep.settlements[0].to.id).toBe('m1');
  });

  it('should have valid highlighted indices in intermediate steps', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Expense 1',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(100000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(100000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(100000), shareInMainScaled: BigInt(100000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Expense 2',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(50000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(50000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's2', memberId: 'm1', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) },
        ],
      },
    ];

    const steps = computeSimplificationSteps(expenses, members);

    for (let i = 1; i < steps.length; i += 2) {
      expect(steps[i].highlightedIndices.length).toBe(2);
      expect(steps[i].highlightedIndices[0]).toBeLessThan(steps[i].settlements.length);
      expect(steps[i].highlightedIndices[1]).toBeLessThan(steps[i].settlements.length);
      expect(steps[i].highlightedIndices[0]).not.toBe(steps[i].highlightedIndices[1]);
    }
  });

  it('should produce final simplified settlements', () => {
    const members = [
      createMember('m1', 'Alice'),
      createMember('m2', 'Bob'),
      createMember('m3', 'Charlie'),
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'group-1',
        description: 'Dinner',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(120000),
        payerMemberId: 'm1',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(120000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's1', memberId: 'm2', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
          { id: 's2', memberId: 'm3', shareAmountScaled: BigInt(60000), shareInMainScaled: BigInt(60000) },
        ],
      },
      {
        id: 'e2',
        groupId: 'group-1',
        description: 'Lunch',
        dateTime: new Date().toISOString(),
        currencyCode: 'USD',
        totalAmountScaled: BigInt(60000),
        payerMemberId: 'm2',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(60000),
        createdAt: new Date().toISOString(),
        shares: [
          { id: 's3', memberId: 'm1', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
          { id: 's4', memberId: 'm3', shareAmountScaled: BigInt(30000), shareInMainScaled: BigInt(30000) },
        ],
      },
    ];

    const steps = computeSimplificationSteps(expenses, members);
    const finalStep = steps[steps.length - 1];
    const simplifiedSettlements = computeSettlementsSimplified(expenses, members);

    expect(finalStep.settlements.length).toBe(simplifiedSettlements.length);

    for (const settlement of simplifiedSettlements) {
      const found = finalStep.settlements.some(s =>
        s.from.id === settlement.from.id &&
        s.to.id === settlement.to.id &&
        s.amountScaled === settlement.amountScaled
      );
      expect(found).toBe(true);
    }
  });
});
