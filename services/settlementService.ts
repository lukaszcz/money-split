import { Expense, User } from './groupRepository';

export interface Settlement {
  from: User;
  to: User;
  amountScaled: bigint;
}

export function computeBalances(expenses: Expense[], allMembers: User[]): Map<string, bigint> {
  const balances = new Map<string, bigint>();

  for (const member of allMembers) {
    balances.set(member.id, BigInt(0));
  }

  for (const expense of expenses) {
    const payerId = expense.payerUserId;
    const totalOwed = expense.totalInMainScaled;

    balances.set(payerId, (balances.get(payerId) || BigInt(0)) + totalOwed);

    for (const share of expense.shares) {
      const userId = share.userId;
      balances.set(userId, (balances.get(userId) || BigInt(0)) - share.shareInMainScaled);
    }
  }

  return balances;
}

export function computeSettlementsNoSimplify(
  expenses: Expense[],
  allMembers: User[]
): Settlement[] {
  const debtMap = new Map<string, Map<string, bigint>>();

  for (const member of allMembers) {
    debtMap.set(member.id, new Map<string, bigint>());
  }

  for (const expense of expenses) {
    const payerId = expense.payerUserId;

    for (const share of expense.shares) {
      const userId = share.userId;

      if (userId === payerId) {
        continue;
      }

      const debtKey = debtMap.get(userId);
      if (debtKey) {
        debtKey.set(payerId, (debtKey.get(payerId) || BigInt(0)) + share.shareInMainScaled);
      }
    }
  }

  for (const debtorId of debtMap.keys()) {
    const debtorDebts = debtMap.get(debtorId)!;

    for (const creditorId of debtorDebts.keys()) {
      const debtorOwesCreditor = debtorDebts.get(creditorId) || BigInt(0);
      const creditorDebts = debtMap.get(creditorId);

      if (!creditorDebts) continue;

      const creditorOwesDebtor = creditorDebts.get(debtorId) || BigInt(0);

      if (creditorOwesDebtor > BigInt(0)) {
        const net = debtorOwesCreditor - creditorOwesDebtor;

        if (net > BigInt(0)) {
          debtorDebts.set(creditorId, net);
          creditorDebts.delete(debtorId);
        } else if (net < BigInt(0)) {
          debtorDebts.delete(creditorId);
          creditorDebts.set(debtorId, -net);
        } else {
          debtorDebts.delete(creditorId);
          creditorDebts.delete(debtorId);
        }
      }
    }
  }

  const settlements: Settlement[] = [];
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  for (const debtorId of debtMap.keys()) {
    const debtorDebts = debtMap.get(debtorId)!;

    for (const creditorId of debtorDebts.keys()) {
      const amount = debtorDebts.get(creditorId);
      if (!amount || amount <= BigInt(0)) continue;

      const debtor = memberMap.get(debtorId);
      const creditor = memberMap.get(creditorId);

      if (debtor && creditor) {
        settlements.push({
          from: debtor,
          to: creditor,
          amountScaled: amount,
        });
      }
    }
  }

  return settlements;
}

export function computeSettlementsSimplified(
  expenses: Expense[],
  allMembers: User[]
): Settlement[] {
  const balances = computeBalances(expenses, allMembers);
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  const debtors: Array<{ userId: string; user: User; amountOwed: bigint }> = [];
  const creditors: Array<{ userId: string; user: User; amountDue: bigint }> = [];

  for (const [userId, balance] of balances.entries()) {
    const user = memberMap.get(userId);
    if (!user) continue;

    if (balance < BigInt(0)) {
      debtors.push({
        userId,
        user,
        amountOwed: -balance,
      });
    } else if (balance > BigInt(0)) {
      creditors.push({
        userId,
        user,
        amountDue: balance,
      });
    }
  }

  const settlements: Settlement[] = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const transferAmount = debtor.amountOwed <= creditor.amountDue
      ? debtor.amountOwed
      : creditor.amountDue;

    settlements.push({
      from: debtor.user,
      to: creditor.user,
      amountScaled: transferAmount,
    });

    debtor.amountOwed -= transferAmount;
    creditor.amountDue -= transferAmount;

    if (debtor.amountOwed === BigInt(0)) {
      debtorIdx++;
    }
    if (creditor.amountDue === BigInt(0)) {
      creditorIdx++;
    }
  }

  return settlements;
}
