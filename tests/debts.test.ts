import { simplifyDebts } from "@/lib/utils";
import type { GroupBalance } from "@/lib/types";

const balance = (
  user_id: string,
  full_name: string,
  amount: number
): GroupBalance => ({ user_id, full_name, balance: amount });

describe("simplifyDebts", () => {
  it("returns no edges when there are no balances", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("creates a single transfer between a debtor and a creditor", () => {
    const edges = simplifyDebts([
      balance("a", "Alice", -10),
      balance("b", "Bob", 10),
    ]);

    expect(edges).toEqual([
      { from: "a", from_name: "Alice", to: "b", to_name: "Bob", amount: 10 },
    ]);
  });

  it("minimizes transfers across multiple parties", () => {
    const edges = simplifyDebts([
      balance("a", "Alice", -30),
      balance("b", "Bob", 20),
      balance("c", "Carol", 10),
    ]);

    expect(edges).toEqual([
      { from: "a", from_name: "Alice", to: "b", to_name: "Bob", amount: 20 },
      { from: "a", from_name: "Alice", to: "c", to_name: "Carol", amount: 10 },
    ]);
  });

  it("ignores sub-cent balances", () => {
    const edges = simplifyDebts([
      balance("a", "Alice", -0.005),
      balance("b", "Bob", 0.005),
    ]);

    expect(edges).toEqual([]);
  });
});
