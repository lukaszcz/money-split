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
  resultIndices: number[];
}

function computeRawDebts(
  expenses: Expense[],
  allMembers: GroupMember[]
): Settlement[] {
  const debtMap = new Map<string, Map<string, bigint>>();
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  for (const member of allMembers) {
    debtMap.set(member.id, new Map<string, bigint>());
  }

  for (const expense of expenses) {
    const payerId = expense.payerMemberId;

    for (const share of expense.shares) {
      const memberId = share.memberId;
      if (memberId === payerId) continue;

      const debtKey = debtMap.get(memberId);
      if (debtKey) {
        debtKey.set(payerId, (debtKey.get(payerId) || BigInt(0)) + share.shareInMainScaled);
      }
    }
  }

  const settlements: Settlement[] = [];

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

function cloneSettlements(settlements: Settlement[]): Settlement[] {
  return settlements.map(s => ({
    from: s.from,
    to: s.to,
    amountScaled: s.amountScaled,
  }));
}

interface SimplificationPair {
  firstIdx: number;
  secondIdx: number;
  type: 'merge' | 'opposite' | 'chain' | 'swap';
}

function findSimplificationPair(settlements: Settlement[]): SimplificationPair | null {
  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const s1 = settlements[i];
      const s2 = settlements[j];

      if (s1.from.id === s2.from.id && s1.to.id === s2.to.id) {
        return { firstIdx: i, secondIdx: j, type: 'merge' };
      }
    }
  }

  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const s1 = settlements[i];
      const s2 = settlements[j];

      if (s1.from.id === s2.to.id && s1.to.id === s2.from.id) {
        return { firstIdx: i, secondIdx: j, type: 'opposite' };
      }
    }
  }

  for (let i = 0; i < settlements.length; i++) {
    for (let j = 0; j < settlements.length; j++) {
      if (i === j) continue;
      const s1 = settlements[i];
      const s2 = settlements[j];

      if (s1.to.id === s2.from.id && s1.from.id !== s2.to.id) {
        return { firstIdx: i, secondIdx: j, type: 'chain' };
      }
    }
  }

  for (let k = 0; k < settlements.length; k++) {
    const s0 = settlements[k];
    for (let i = k + 1; i < settlements.length; i++) {
      for (let j = k + 1; j < settlements.length; j++) {
        if (i === j) continue;
        const s1 = settlements[i];
        const s2 = settlements[j];

        if (s0.from.id == s1.from.id && s0.to.id === s2.to.id) {
          return { firstIdx: i, secondIdx: j, type: 'swap' };
        }
      }
    }
  }
  
  return null;
}

function getResultIndices(
  settlements: Settlement[],
  pair: SimplificationPair
): number[] {
  const { firstIdx, secondIdx, type } = pair;
  const first = settlements[firstIdx];
  const second = settlements[secondIdx];
  const idx = Math.min(firstIdx, secondIdx);
  if (type === 'merge') {
    return [idx];
  } else if (type === 'opposite') {
    if (first.amountScaled == second.amountScaled) {
      return [];
    } else {
      return [idx];
    }
  } else if (type === 'chain') {
    if (first.amountScaled == second.amountScaled) {
      return [idx];
    } else {
      return [idx, idx + 1];
    }
  } else {
    if (first.amountScaled == second.amountScaled) {
      return [idx, idx + 1];
    } else {
      return [idx, idx + 1, idx + 2];
    }
  }
}

function applySimplification(
  settlements: Settlement[],
  pair: SimplificationPair
): [Settlement[], number[]] {
  const { firstIdx, secondIdx, type } = pair;
  const first = settlements[firstIdx];
  const second = settlements[secondIdx];
  const newSettlements = settlements.filter((_, idx) => idx !== firstIdx && idx !== secondIdx);
  const resultIndices = getResultIndices(settlements, pair);

  if (type === 'merge') {
    const net = first.amountScaled + second.amountScaled;
    newSettlements.splice(resultIndices[0], 0, {
      from: first.from,
      to: first.to,
      amountScaled: net,
    });
  } else if (type === 'opposite') {
    const net = first.amountScaled - second.amountScaled;
    if (net > BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: first.from,
        to: first.to,
        amountScaled: net,
      });
    } else if (net < BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: second.from,
        to: second.to,
        amountScaled: -net,
      });
    }
  } else if (type == 'chain') {
    const transferAmount = first.amountScaled < second.amountScaled
      ? first.amountScaled
      : second.amountScaled;

    const remainingFirst = first.amountScaled - transferAmount;
    const remainingSecond = second.amountScaled - transferAmount;

    if (remainingFirst > BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: first.from,
        to: first.to,
        amountScaled: remainingFirst,
      });
    }

    if (remainingSecond > BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: second.from,
        to: second.to,
        amountScaled: remainingSecond,
      });
    }

    newSettlements.splice(resultIndices.at(-1), 0, {
      from: first.from,
      to: second.to,
      amountScaled: transferAmount,
    });
  } else {
    // type === 'swap'
    const net = first.amountScaled - second.amountScaled;
    if (net > BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: first.from,
        to: first.to,
        amountScaled: net,
      });
      newSettlements.splice(resultIndices[1], 0, {
        from: first.from,
        to: second.to,
        amountScaled: second.amountScaled,
      });
      newSettlements.splice(resultIndices[2], 0, {
        from: second.from,
        to: first.to,
        amountScaled: first.amountScaled,
      });
    } else if (net < BigInt(0)) {
      newSettlements.splice(resultIndices[0], 0, {
        from: second.from,
        to: second.to,
        amountScaled: -net,
      });
      newSettlements.splice(resultIndices[1], 0, {
        from: second.from,
        to: first.to,
        amountScaled: first.amountScaled,
      });
      newSettlements.splice(resultIndices[2], 0, {
        from: second.from,
        to: first.to,
        amountScaled: first.amountScaled,
      });
    } else {
      
    }    
  }

  return [newSettlements, resultIndices];
}

export function computeSimplificationSteps(
  expenses: Expense[],
  allMembers: GroupMember[]
): SimplificationStep[] {
  const steps: SimplificationStep[] = [];
  let currentSettlements = computeRawDebts(expenses, allMembers);

  steps.push({
    settlements: cloneSettlements(currentSettlements),
    highlightedIndices: [],
    resultIndices: [],
  });

  let pair = findSimplificationPair(currentSettlements);

  while (pair !== null) {
    steps.push({
      settlements: cloneSettlements(currentSettlements),
      highlightedIndices: [pair.firstIdx, pair.secondIdx],
      resultIndices: [],
    });

    const [newSettlements, resultIndices] = applySimplification(currentSettlements, pair);

    steps.push({
      settlements: cloneSettlements(newSettlements),
      highlightedIndices: [],
      resultIndices,
    });

    currentSettlements = newSettlements;
    pair = findSimplificationPair(currentSettlements);
  }

  return steps;
}
