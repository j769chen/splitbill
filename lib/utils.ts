import {
  DEFAULT_CURRENCY,
  getCurrencyDecimals,
  getCurrencySymbol,
  type CurrencyCode,
} from "./currency";
import type { SplitType } from "./types";

export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY
): string {
  const decimals = getCurrencyDecimals(currencyCode);
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = Math.abs(amount).toFixed(decimals);
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

// Converts each split into a base-currency amount using `rate` and assigns any
// rounding remainder to the first split so the base amounts sum exactly to
// `baseTotal` (mirrors the remainder handling in splitEqual).
export function convertSplitsToBase<T extends { amount: number }>(
  splits: T[],
  rate: number,
  baseTotal: number
): (T & { baseAmount: number })[] {
  const result = splits.map((split) => ({
    ...split,
    baseAmount: Math.round(split.amount * rate * 100) / 100,
  }));
  const sum = result.reduce((acc, s) => acc + s.baseAmount, 0);
  const remainder = Math.round((baseTotal - sum) * 100) / 100;
  if (remainder !== 0 && result.length > 0) {
    result[0].baseAmount =
      Math.round((result[0].baseAmount + remainder) * 100) / 100;
  }
  return result;
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
  rawInputs: Record<string, string>,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY
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
        error: `Split amounts (${formatCurrency(sum, currencyCode)}) don't add up to total (${formatCurrency(totalAmount, currencyCode)})`,
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
