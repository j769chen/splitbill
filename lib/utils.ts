import type { DebtEdge, GroupBalance } from "./types";

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
