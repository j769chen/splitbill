import { renderHook, waitFor } from "@testing-library/react-native";
import { createWrapper } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useGroupBalances,
  useGroupSimplifiedEdges,
  useUserTotalBalance,
} from "@/lib/queries/useBalances";

jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));

const mockedSupabase = supabase as unknown as { rpc: jest.Mock };
const mockedUseAuth = useAuth as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("useGroupBalances", () => {
  it("returns the balances rows for the group", async () => {
    const balances = [{ user_id: "u1", full_name: "Alice", balance: 10 }];
    mockedSupabase.rpc.mockResolvedValue({ data: balances, error: null });

    const { result } = await renderHook(() => useGroupBalances("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(balances);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_group_balances", {
      p_group_id: "g1",
    });
  });

  it("defaults to an empty array when the RPC returns null", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useGroupBalances("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

});

describe("useGroupSimplifiedEdges", () => {
  it("maps server edge rows into DebtEdge objects with numeric amounts", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        {
          from_user: "u1",
          from_name: "Alice",
          to_user: "u2",
          to_name: "Bob",
          amount: "12.5",
        },
      ],
      error: null,
    });

    const { result } = await renderHook(() => useGroupSimplifiedEdges("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "get_group_simplified_edges",
      { p_group_id: "g1" }
    );
    expect(result.current.data).toEqual([
      { from: "u1", from_name: "Alice", to: "u2", to_name: "Bob", amount: 12.5 },
    ]);
  });

  it("defaults to an empty array when the RPC returns null", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useGroupSimplifiedEdges("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("does not run while disabled", async () => {
    const { result } = await renderHook(
      () => useGroupSimplifiedEdges("g1", false),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe("useUserTotalBalance", () => {
  it("converts per-context balances and folds them into owed/owing", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        { balance: 10, currency: "USD" },
        { balance: -4, currency: "USD" },
      ],
      error: null,
    });

    const { result } = await renderHook(() => useUserTotalBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      totalOwed: 10,
      totalOwing: 4,
      net: 6,
      displayCurrency: "USD",
    });
  });

  it("converts foreign-currency contexts into the display currency", async () => {
    // EUR rate is 0.5 per USD in the test mock, so 5 EUR = 10 USD.
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ balance: 5, currency: "EUR" }],
      error: null,
    });

    const { result } = await renderHook(() => useUserTotalBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      totalOwed: 10,
      totalOwing: 0,
      net: 10,
      displayCurrency: "USD",
    });
  });

  it("falls back to zeroed totals when there is no row", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = await renderHook(() => useUserTotalBalance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      totalOwed: 0,
      totalOwing: 0,
      net: 0,
      displayCurrency: "USD",
    });
  });

});
