import { renderHook } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCreateExpense, useDeleteExpense } from "@/lib/queries/useExpenses";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));

const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  rpc: jest.Mock;
};
const mockedUseAuth = useAuth as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("useCreateExpense", () => {
  it("rejects when split amounts do not add up to the total", async () => {
    const { result } = await renderHook(() => useCreateExpense(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          paidBy: "user-1",
          amount: 10,
          description: "Lunch",
          splitType: "equal",
          splits: [
            { userId: "user-1", amount: 4 },
            { userId: "user-2", amount: 4 },
          ],
        })
      )
    ).rejects.toThrow("Split amounts must add up to the expense total");

    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls the create_expense_with_splits RPC with mapped params", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: { id: "exp-1" }, error: null });

    const { result } = await renderHook(() => useCreateExpense(), {
      wrapper: createWrapper(),
    });

    const created = await actAsync(() =>
      result.current.mutateAsync({
        groupId: "g1",
        paidBy: "user-1",
        amount: 10,
        description: "Lunch",
        category: "food",
        splitType: "equal",
        splits: [
          { userId: "user-1", amount: 5 },
          { userId: "user-2", amount: 5 },
        ],
      })
    );

    expect(created).toEqual({ id: "exp-1" });
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "create_expense_with_splits",
      {
        p_group_id: "g1",
        p_paid_by: "user-1",
        p_amount: 10,
        p_description: "Lunch",
        p_category: "food",
        p_split_type: "equal",
        p_splits: [
          { userId: "user-1", amount: 5 },
          { userId: "user-2", amount: 5 },
        ],
        p_date: null,
      }
    );
  });

  it("propagates RPC errors", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error("rpc failed"),
    });

    const { result } = await renderHook(() => useCreateExpense(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          paidBy: "user-1",
          amount: 10,
          description: "Lunch",
          splitType: "equal",
          splits: [{ userId: "user-1", amount: 10 }],
        })
      )
    ).rejects.toThrow("rpc failed");
  });
});

describe("useDeleteExpense", () => {
  it("deletes by expense id", async () => {
    const builder = queryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeleteExpense(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ expenseId: "exp-1", groupId: "g1" })
    );

    expect(result.current.isSuccess).toBe(true);
    expect(mockedSupabase.from).toHaveBeenCalledWith("expenses");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "exp-1");
  });

  it("propagates delete errors", async () => {
    const builder = queryBuilder({ data: null, error: new Error("nope") });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeleteExpense(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({ expenseId: "exp-1", groupId: "g1" })
      )
    ).rejects.toThrow("nope");
  });
});
