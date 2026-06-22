import type { DebtEdge, GroupBalance, SplitType } from "./types";

export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function simplifyDebts(balances: GroupBalance[]): DebtEdge[] {
  const debtors: { user_id: string; full_name: string; amount: number }[] = [];
  const creditors: { user_id: string; full_name: string; amount: number }[] =
    [];

  for (const b of balances) {
    if (b.balance < -0.01) {
      debtors.push({ user_id: b.user_id, full_name: b.full_name, amount: -b.balance });
    } else if (b.balance > 0.01) {
      creditors.push({ user_id: b.user_id, full_name: b.full_name, amount: b.balance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0.01) {
      edges.push({
        from: debtors[i].user_id,
        from_name: debtors[i].full_name,
        to: creditors[j].user_id,
        to_name: creditors[j].full_name,
        amount: Math.round(transfer * 100) / 100,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return edges;
}

export function splitEqual(total: number, memberCount: number): number[] {
  const perPerson = Math.floor((total * 100) / memberCount) / 100;
  const remainder = Math.round((total - perPerson * memberCount) * 100) / 100;
  const splits = new Array(memberCount).fill(perPerson);
  if (remainder > 0) {
    splits[0] = Math.round((splits[0] + remainder) * 100) / 100;
  }
  return splits;
}

export function validateSplitsTotal(total: number, splits: number[]): boolean {
  const roundedTotal = Math.round(total * 100) / 100;
  const splitTotal = splits.reduce((sum, amount) => sum + amount, 0);
  return Math.round(splitTotal * 100) / 100 === roundedTotal;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export type ComputeSplitsResult =
  | { ok: true; splits: { userId: string; amount: number }[] }
  | { ok: false; error: string };

export function computeSplits(
  splitType: SplitType,
  totalAmount: number,
  memberIds: string[],
  rawInputs: Record<string, string>
): ComputeSplitsResult {
  if (splitType === "equal") {
    const amounts = splitEqual(totalAmount, memberIds.length);
    return {
      ok: true,
      splits: memberIds.map((userId, i) => ({ userId, amount: amounts[i] })),
    };
  }

  if (splitType === "exact") {
    const splits = memberIds.map((userId) => ({
      userId,
      amount: parseFloat(rawInputs[userId] || "0"),
    }));
    const sum = splits.reduce((acc, s) => acc + s.amount, 0);
    if (Math.abs(sum - totalAmount) > 0.01) {
      return {
        ok: false,
        error: `Split amounts ($${sum.toFixed(2)}) don't add up to total ($${totalAmount.toFixed(2)})`,
      };
    }
    return { ok: true, splits };
  }

  const pctSum = memberIds.reduce(
    (acc, userId) => acc + parseFloat(rawInputs[userId] || "0"),
    0
  );
  if (Math.abs(pctSum - 100) > 0.01) {
    return {
      ok: false,
      error: `Percentages must add up to 100% (currently ${pctSum.toFixed(1)}%)`,
    };
  }
  // Distribute by percentage, assigning any rounding remainder to the
  // last member so splits always sum exactly to the total.
  const splits = memberIds.map((userId) => {
    const pct = parseFloat(rawInputs[userId] || "0");
    return { userId, amount: Math.round(totalAmount * pct) / 100 };
  });
  const splitSum = splits.reduce((acc, s) => acc + s.amount, 0);
  const remainder = Math.round((totalAmount - splitSum) * 100) / 100;
  if (remainder !== 0 && splits.length > 0) {
    const last = splits[splits.length - 1];
    last.amount = Math.round((last.amount + remainder) * 100) / 100;
  }
  return { ok: true, splits };
}
