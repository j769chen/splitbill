import { renderHook, waitFor } from "@testing-library/react-native";
import { createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useGroupBalances,
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

describe("useUserTotalBalance", () => {
  it("computes the net balance from owed and owing totals", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ total_owed: 10, total_owing: 4 }],
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
    });
  });
});
