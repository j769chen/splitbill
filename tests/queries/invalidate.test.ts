import { QueryClient } from "@tanstack/react-query";
import {
  invalidateActivityQueries,
  invalidateContactPairQueries,
  invalidateContactQueries,
  invalidateGroupQueries,
} from "@/lib/queries/invalidate";

function spyOnClient() {
  const client = new QueryClient();
  const invalidate = jest
    .spyOn(client, "invalidateQueries")
    .mockImplementation(() => Promise.resolve());
  const keys = () =>
    invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
  return { client, keys };
}

const ACTIVITY_KEYS = [
  ["activity"],
  ["activity-payments"],
  ["contact-activity"],
  ["contact-payments-activity"],
  ["simplify-debts-activity"],
];

const CONTACT_KEYS = [["contacts"], ["contact-balance"], ["contact-group-breakdown"]];

describe("invalidation sets", () => {
  it("refreshes every contact surface", () => {
    const { client, keys } = spyOnClient();
    invalidateContactQueries(client);

    for (const key of CONTACT_KEYS) {
      expect(keys()).toContain(JSON.stringify(key));
    }
  });

  it("refreshes all five activity feed queries", () => {
    const { client, keys } = spyOnClient();
    invalidateActivityQueries(client);

    for (const key of ACTIVITY_KEYS) {
      expect(keys()).toContain(JSON.stringify(key));
    }
  });

  it("covers group-derived data, contacts and the feed for a group write", () => {
    const { client, keys } = spyOnClient();
    invalidateGroupQueries(client, "g1");

    for (const key of [
      ["expenses", "g1"],
      ["payments", "g1"],
      ["balances", "g1"],
      ["group-pairwise-all", "g1"],
      ["group-simplified", "g1"],
      ["total-balance"],
      ...CONTACT_KEYS,
      ...ACTIVITY_KEYS,
    ]) {
      expect(keys()).toContain(JSON.stringify(key));
    }
  });

  it("covers pair-derived data, contacts and the feed for a contact write", () => {
    const { client, keys } = spyOnClient();
    invalidateContactPairQueries(client, "u1", "u2");

    for (const key of [
      ["contact-expenses", "u1", "u2"],
      ["contact-payments", "u1", "u2"],
      ["contact-balance", "u1", "u2"],
      ["contact-pair-balance", "u1", "u2"],
      ["total-balance"],
      ...CONTACT_KEYS,
      ...ACTIVITY_KEYS,
    ]) {
      expect(keys()).toContain(JSON.stringify(key));
    }
  });
});
