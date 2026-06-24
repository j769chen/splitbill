import { convertSplitsToBase, formatCurrency } from "@/lib/utils";
import { canConvert } from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats positive amounts with a dollar sign and two decimals", () => {
    expect(formatCurrency(12.5)).toBe("$12.50");
  });

  it("formats negative amounts with a leading minus", () => {
    expect(formatCurrency(-12.5)).toBe("-$12.50");
  });

  it("formats zero without a minus sign", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(1.005)).toBe("$1.00");
    expect(formatCurrency(2.349)).toBe("$2.35");
    expect(formatCurrency(-2.349)).toBe("-$2.35");
  });

  it("uses the symbol for the given currency code", () => {
    expect(formatCurrency(12.5, "EUR")).toBe("€12.50");
    expect(formatCurrency(-12.5, "GBP")).toBe("-£12.50");
  });

  it("respects per-currency decimal places", () => {
    expect(formatCurrency(1200, "JPY")).toBe("¥1200");
    expect(formatCurrency(-1200.4, "JPY")).toBe("-¥1200");
  });

  it("falls back to a code-prefixed symbol for unknown currencies", () => {
    expect(formatCurrency(5, "ZZZ")).toBe("ZZZ 5.00");
  });
});

describe("convertSplitsToBase", () => {
  it("returns the same amounts when the rate is 1", () => {
    const result = convertSplitsToBase(
      [
        { userId: "a", amount: 10 },
        { userId: "b", amount: 5 },
      ],
      1,
      15
    );
    expect(result).toEqual([
      { userId: "a", amount: 10, baseAmount: 10 },
      { userId: "b", amount: 5, baseAmount: 5 },
    ]);
  });

  it("converts each split and assigns the rounding remainder to the first", () => {
    // 10 * 0.3333 = 3.333 -> rounds to 3.33 each (sum 9.99); the 0.01 needed to
    // reach the base total of 10 lands on the first split.
    const result = convertSplitsToBase(
      [
        { userId: "a", amount: 10 },
        { userId: "b", amount: 10 },
        { userId: "c", amount: 10 },
      ],
      0.3333,
      10
    );
    const total = result.reduce((sum, s) => sum + s.baseAmount, 0);
    expect(Math.round(total * 100) / 100).toBe(10);
    expect(result[0].baseAmount).toBeCloseTo(3.34, 2);
    expect(result[1].baseAmount).toBeCloseTo(3.33, 2);
  });
});

describe("canConvert", () => {
  it("allows same-currency conversion without rates", () => {
    expect(canConvert("USD", "USD", undefined)).toBe(true);
  });

  it("requires both rates for foreign-currency conversion", () => {
    expect(canConvert("EUR", "USD", { USD: 1, EUR: 0.9 })).toBe(true);
    expect(canConvert("EUR", "USD", { USD: 1 })).toBe(false);
    expect(canConvert("EUR", "USD", undefined)).toBe(false);
  });
});
