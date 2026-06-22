import { formatCurrency } from "@/lib/utils";

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
});
