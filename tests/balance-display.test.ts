import {
  formatCompactPeerBalance,
  formatContactSettleLabel,
  formatContactSummaryLabel,
  formatMemberOverallSummary,
  formatSharedGroupBalance,
  getBalanceDirection,
  getOverallBalanceParts,
  hasSignificantBalance,
} from "@/lib/balance-display";

describe("balance display helpers", () => {
  it("classifies balances using the app display threshold", () => {
    expect(getBalanceDirection(0.02)).toBe("owed");
    expect(getBalanceDirection(-0.02)).toBe("owing");
    expect(getBalanceDirection(0.01)).toBe("settled");
    expect(hasSignificantBalance(-0.02)).toBe(true);
    expect(hasSignificantBalance(0)).toBe(false);
  });

  it("formats compact peer balances", () => {
    expect(formatCompactPeerBalance(12, "USD")).toBe("owes you $12.00");
    expect(formatCompactPeerBalance(-12, "USD")).toBe("you owe $12.00");
    expect(formatCompactPeerBalance(0, "USD")).toBe("settled up");
  });

  it("formats named contact labels without changing copy", () => {
    expect(formatContactSummaryLabel(12, "Bob")).toBe("Bob owes you");
    expect(formatContactSummaryLabel(-12, "Bob")).toBe("You owe Bob");
    expect(formatContactSummaryLabel(0, "Bob")).toBe(
      "You're all settled up"
    );

    expect(formatContactSettleLabel(12, "USD", "Bob")).toBe(
      "Bob owes you $12.00"
    );
    expect(formatContactSettleLabel(-12, "USD", "Bob")).toBe(
      "You owe Bob $12.00"
    );
    expect(formatContactSettleLabel(0, "USD", "Bob")).toBe(
      "You're all settled up with Bob"
    );
  });

  it("formats group and overall summaries", () => {
    expect(formatSharedGroupBalance(12, "USD", "Bob")).toBe(
      "Bob owes you $12.00"
    );
    expect(formatSharedGroupBalance(-12, "USD", "Bob")).toBe(
      "You owe $12.00"
    );
    expect(formatSharedGroupBalance(0, "USD", "Bob")).toBe("Settled up");

    expect(formatMemberOverallSummary(12)).toBe("is owed overall");
    expect(formatMemberOverallSummary(-12)).toBe("owes overall");
    expect(formatMemberOverallSummary(0)).toBe("settled up");

    expect(getOverallBalanceParts(12, "USD")).toEqual({
      prefix: "You are owed ",
      amount: "$12.00",
      suffix: " overall",
    });
  });
});
