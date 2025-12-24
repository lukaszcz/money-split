import { Expense, GroupMember } from './groupRepository';

export interface Settlement {
  from: GroupMember;
  to: GroupMember;
  amountScaled: bigint;
}

export function computeBalances(
  expenses: Expense[],
  allMembers: GroupMember[]
): Map<string, bigint> {
  const balances = new Map<string, bigint>();

  for (const member of allMembers) {
    balances.set(member.id, BigInt(0));
  }

  for (const expense of expenses) {
    const payerId = expense.payerMemberId;
    const totalOwed = expense.totalInMainScaled;

    balances.set(payerId, (balances.get(payerId) || BigInt(0)) + totalOwed);

    for (const share of expense.shares) {
      const memberId = share.memberId;
      balances.set(memberId, (balances.get(memberId) || BigInt(0)) - share.shareInMainScaled);
    }
  }

  return balances;
}

export function computeSettlementsNoSimplify(
  expenses: Expense[],
  allMembers: GroupMember[]
): Settlement[] {
  const debtMap = new Map<string, Map<string, bigint>>();

  for (const member of allMembers) {
    debtMap.set(member.id, new Map<string, bigint>());
  }

  for (const expense of expenses) {
    const payerId = expense.payerMemberId;

    for (const share of expense.shares) {
      const memberId = share.memberId;

      if (memberId === payerId) {
        continue;
      }

      const debtKey = debtMap.get(memberId);
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
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

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
  allMembers: GroupMember[]
): Settlement[] {
  const balances = computeBalances(expenses, allMembers);
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  const debtors: Array<{ memberId: string; member: GroupMember; amountOwed: bigint }> = [];
  const creditors: Array<{ memberId: string; member: GroupMember; amountDue: bigint }> = [];

  for (const [memberId, balance] of balances.entries()) {
    const member = memberMap.get(memberId);
    if (!member) continue;

    if (balance < BigInt(0)) {
      debtors.push({
        memberId,
        member,
        amountOwed: -balance,
      });
    } else if (balance > BigInt(0)) {
      creditors.push({
        memberId,
        member,
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

    const transferAmount =
      debtor.amountOwed <= creditor.amountDue ? debtor.amountOwed : creditor.amountDue;

    settlements.push({
      from: debtor.member,
      to: creditor.member,
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

export interface SimplificationStep {
  settlements: Settlement[];
  highlightedIndices: number[];
}

function settlementsEqual(s1: Settlement, s2: Settlement): boolean {
  return s1.from.id === s2.from.id && s1.to.id === s2.to.id && s1.amountScaled === s2.amountScaled;
}

export function computeSimplificationSteps(
  expenses: Expense[],
  allMembers: GroupMember[]
): SimplificationStep[] {
  const steps: SimplificationStep[] = [];

  let currentSettlements = computeSettlementsNoSimplify(expenses, allMembers);

  steps.push({
    settlements: [...currentSettlements],
    highlightedIndices: [],
  });

  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 0; i < currentSettlements.length && !changed; i++) {
      for (let j = i + 1; j < currentSettlements.length && !changed; j++) {
        const s1 = currentSettlements[i];
        const s2 = currentSettlements[j];

        if (s1.from.id === s2.to.id && s2.from.id === s1.to.id) {
          steps.push({
            settlements: [...currentSettlements],
            highlightedIndices: [i, j],
          });

          const net = s1.amountScaled - s2.amountScaled;
          const newSettlements = currentSettlements.filter((_, idx) => idx !== i && idx !== j);

          if (net > BigInt(0)) {
            newSettlements.push({
              from: s1.from,
              to: s1.to,
              amountScaled: net,
            });
          } else if (net < BigInt(0)) {
            newSettlements.push({
              from: s2.from,
              to: s2.to,
              amountScaled: -net,
            });
          }

          currentSettlements = newSettlements;
          changed = true;
        }
        else if (s1.to.id === s2.from.id && s1.from.id !== s2.to.id) {
          steps.push({
            settlements: [...currentSettlements],
            highlightedIndices: [i, j],
          });

          const newS1Amount = s1.amountScaled <= s2.amountScaled ? BigInt(0) : s1.amountScaled - s2.amountScaled;
          const newS2Amount = s2.amountScaled <= s1.amountScaled ? BigInt(0) : s2.amountScaled - s1.amountScaled;
          const newTransferAmount = s1.amountScaled <= s2.amountScaled ? s1.amountScaled : s2.amountScaled;

          const newSettlements = currentSettlements.filter((_, idx) => idx !== i && idx !== j);

          if (newS1Amount > BigInt(0)) {
            newSettlements.push({
              from: s1.from,
              to: s1.to,
              amountScaled: newS1Amount,
            });
          }

          if (newS2Amount > BigInt(0)) {
            newSettlements.push({
              from: s2.from,
              to: s2.to,
              amountScaled: newS2Amount,
            });
          }

          newSettlements.push({
            from: s1.from,
            to: s2.to,
            amountScaled: newTransferAmount,
          });

          currentSettlements = newSettlements;
          changed = true;
        }
      }
    }

    if (changed) {
      steps.push({
        settlements: [...currentSettlements],
        highlightedIndices: [],
      });
    }
  }

  return steps;
}
