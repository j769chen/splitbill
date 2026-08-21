import { formatCurrency } from "@/lib/utils";
import type { AppTheme } from "@/lib/theme";

const BALANCE_EPSILON = 0.01;

export type BalanceDirection = "owed" | "owing" | "settled";

type BalanceColors = Pick<
  AppTheme["colors"],
  "success" | "error" | "onSurfaceVariant"
>;

export function getBalanceDirection(balance: number): BalanceDirection {
  if (balance > BALANCE_EPSILON) return "owed";
  if (balance < -BALANCE_EPSILON) return "owing";
  return "settled";
}

export function hasSignificantBalance(balance: number): boolean {
  return getBalanceDirection(balance) !== "settled";
}

// Every consumer below answers the same three-way question about a balance, so
// each one supplies one branch per direction and shares the dispatch.
function byDirection<T>(
  balance: number,
  branches: Record<BalanceDirection, () => T>
): T {
  return branches[getBalanceDirection(balance)]();
}

export function getBalanceColor(
  balance: number,
  colors: BalanceColors
): string {
  return byDirection(balance, {
    owed: () => colors.success,
    owing: () => colors.error,
    settled: () => colors.onSurfaceVariant,
  });
}

export function formatCompactPeerBalance(
  balance: number,
  currency?: string
): string {
  return byDirection(balance, {
    owed: () => `owes you ${formatCurrency(balance, currency)}`,
    owing: () => `you owe ${formatCurrency(Math.abs(balance), currency)}`,
    settled: () => "settled up",
  });
}

export function formatSharedGroupBalance(
  balance: number,
  currency: string,
  contactName: string
): string {
  return byDirection(balance, {
    owed: () => `${contactName} owes you ${formatCurrency(balance, currency)}`,
    owing: () => `You owe ${formatCurrency(Math.abs(balance), currency)}`,
    settled: () => "Settled up",
  });
}

export function formatContactSummaryLabel(
  balance: number,
  contactName: string
): string {
  return byDirection(balance, {
    owed: () => `${contactName} owes you`,
    owing: () => `You owe ${contactName}`,
    settled: () => "You're all settled up",
  });
}

export function formatContactSettleLabel(
  balance: number,
  currency: string,
  contactName: string
): string {
  return byDirection(balance, {
    owed: () => `${contactName} owes you ${formatCurrency(balance, currency)}`,
    owing: () =>
      `You owe ${contactName} ${formatCurrency(Math.abs(balance), currency)}`,
    settled: () => `You're all settled up with ${contactName}`,
  });
}

export function formatMemberOverallSummary(balance: number): string {
  return byDirection(balance, {
    owed: () => "is owed overall",
    owing: () => "owes overall",
    settled: () => "settled up",
  });
}

export function getOverallBalanceParts(
  net: number,
  currency: string
): { prefix: string; amount: string; suffix: string } {
  return byDirection(net, {
    owed: () => ({
      prefix: "You are owed ",
      amount: formatCurrency(net, currency),
      suffix: " overall",
    }),
    owing: () => ({
      prefix: "You owe ",
      amount: formatCurrency(Math.abs(net), currency),
      suffix: " overall",
    }),
    settled: () => ({ prefix: "You are settled up!", amount: "", suffix: "" }),
  });
}
