import { computeSplits } from "@/lib/utils";

const sum = (splits: { amount: number }[]) =>
  Math.round(splits.reduce((acc, s) => acc + s.amount, 0) * 100) / 100;

describe("computeSplits - equal", () => {
  it("splits evenly across members and preserves the total", () => {
    const result = computeSplits("equal", 30, ["a", "b", "c"], {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.splits).toEqual([
      { userId: "a", amount: 10 },
      { userId: "b", amount: 10 },
      { userId: "c", amount: 10 },
    ]);
    expect(sum(result.splits)).toBe(30);
  });

  it("handles indivisible amounts by assigning the remainder to the first member", () => {
    const result = computeSplits("equal", 10, ["a", "b", "c"], {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.splits).toEqual([
      { userId: "a", amount: 3.34 },
      { userId: "b", amount: 3.33 },
      { userId: "c", amount: 3.33 },
    ]);
    expect(sum(result.splits)).toBe(10);
  });
});

describe("computeSplits - exact", () => {
  it("accepts exact amounts that add up to the total", () => {
    const result = computeSplits("exact", 10, ["a", "b"], {
      a: "6",
      b: "4",
    });

    expect(result).toEqual({
      ok: true,
      splits: [
        { userId: "a", amount: 6 },
        { userId: "b", amount: 4 },
      ],
    });
  });

  it("treats missing inputs as zero", () => {
    const result = computeSplits("exact", 5, ["a", "b"], { a: "5" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.splits).toEqual([
      { userId: "a", amount: 5 },
      { userId: "b", amount: 0 },
    ]);
  });

  it("rejects exact amounts that do not reconcile to the total", () => {
    const result = computeSplits("exact", 10, ["a", "b"], {
      a: "6",
      b: "3",
    });

    expect(result).toEqual({
      ok: false,
      error: "Split amounts ($9.00) don't add up to total ($10.00)",
    });
  });
});

describe("computeSplits - percentage", () => {
  it("distributes by percentage and pushes the rounding remainder to the last member", () => {
    const result = computeSplits("percentage", 100, ["a", "b", "c"], {
      a: "33",
      b: "33",
      c: "34",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.splits).toEqual([
      { userId: "a", amount: 33 },
      { userId: "b", amount: 33 },
      { userId: "c", amount: 34 },
    ]);
    expect(sum(result.splits)).toBe(100);
  });

  it("assigns rounding remainder to the last member so splits sum exactly", () => {
    const result = computeSplits("percentage", 10, ["a", "b", "c"], {
      a: "33.33",
      b: "33.33",
      c: "33.34",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sum(result.splits)).toBe(10);
  });

  it("rejects percentages that do not add up to 100", () => {
    const result = computeSplits("percentage", 100, ["a", "b"], {
      a: "40",
      b: "40",
    });

    expect(result).toEqual({
      ok: false,
      error: "Percentages must add up to 100% (currently 80.0%)",
    });
  });
});
