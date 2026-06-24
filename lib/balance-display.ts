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

export function getBalanceColor(
  balance: number,
  colors: BalanceColors
): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") return colors.success;
  if (direction === "owing") return colors.error;
  return colors.onSurfaceVariant;
}

export function formatCompactPeerBalance(
  balance: number,
  currency?: string
): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") {
    return `owes you ${formatCurrency(balance, currency)}`;
  }
  if (direction === "owing") {
    return `you owe ${formatCurrency(Math.abs(balance), currency)}`;
  }
  return "settled up";
}

export function formatSharedGroupBalance(
  balance: number,
  currency: string,
  contactName: string
): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") {
    return `${contactName} owes you ${formatCurrency(balance, currency)}`;
  }
  if (direction === "owing") {
    return `You owe ${formatCurrency(Math.abs(balance), currency)}`;
  }
  return "Settled up";
}

export function formatContactSummaryLabel(
  balance: number,
  contactName: string
): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") return `${contactName} owes you`;
  if (direction === "owing") return `You owe ${contactName}`;
  return "You're all settled up";
}

export function formatContactSettleLabel(
  balance: number,
  currency: string,
  contactName: string
): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") {
    return `${contactName} owes you ${formatCurrency(balance, currency)}`;
  }
  if (direction === "owing") {
    return `You owe ${contactName} ${formatCurrency(Math.abs(balance), currency)}`;
  }
  return `You're all settled up with ${contactName}`;
}

export function formatMemberOverallSummary(balance: number): string {
  const direction = getBalanceDirection(balance);
  if (direction === "owed") return "is owed overall";
  if (direction === "owing") return "owes overall";
  return "settled up";
}

export function getOverallBalanceParts(
  net: number,
  currency: string
): { prefix: string; amount: string; suffix: string } {
  const direction = getBalanceDirection(net);
  if (direction === "owed") {
    return {
      prefix: "You are owed ",
      amount: formatCurrency(net, currency),
      suffix: " overall",
    };
  }
  if (direction === "owing") {
    return {
      prefix: "You owe ",
      amount: formatCurrency(Math.abs(net), currency),
      suffix: " overall",
    };
  }
  return { prefix: "You are settled up!", amount: "", suffix: "" };
}
