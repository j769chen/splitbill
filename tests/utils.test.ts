import { validateSplitsTotal } from "@/lib/utils";

describe("money utilities", () => {
  it("validates that split amounts reconcile to the total", () => {
    expect(validateSplitsTotal(10, [3.34, 3.33, 3.33])).toBe(true);
    expect(validateSplitsTotal(10, [3.33, 3.33, 3.33])).toBe(false);
  });
});
