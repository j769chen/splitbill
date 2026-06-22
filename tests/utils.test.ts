import { getErrorMessage, splitEqual, validateSplitsTotal } from "@/lib/utils";

describe("money utilities", () => {
  it("splits an amount evenly while preserving the total", () => {
    const splits = splitEqual(10, 3);

    expect(splits).toEqual([3.34, 3.33, 3.33]);
    expect(splits.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(10);
  });

  it("validates that split amounts reconcile to the total", () => {
    expect(validateSplitsTotal(10, [3.34, 3.33, 3.33])).toBe(true);
    expect(validateSplitsTotal(10, [3.33, 3.33, 3.33])).toBe(false);
  });

  it("extracts messages from Error values with a fallback", () => {
    expect(getErrorMessage(new Error("Failed"), "Fallback")).toBe("Failed");
    expect(getErrorMessage("nope", "Fallback")).toBe("Fallback");
  });
});
