import { validateSplitsTotal } from "@/lib/utils";

describe("money utilities", () => {
  it("validates that split amounts reconcile to the total", () => {
    expect(validateSplitsTotal(10, [3.34, 3.33, 3.33])).toBe(true);
    expect(validateSplitsTotal(10, [3.33, 3.33, 3.33])).toBe(false);
  });

  it("validates against the currency's decimal places", () => {
    expect(validateSplitsTotal(1000, [334, 333, 333], 0)).toBe(true);
    expect(validateSplitsTotal(1000, [333, 333, 333], 0)).toBe(false);
  });
});
