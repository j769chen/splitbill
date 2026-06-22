import { renderHook } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useCreatePayment } from "@/lib/queries/usePayments";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockedSupabase = supabase as unknown as { from: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useCreatePayment", () => {
  it("inserts a payment with mapped fields and a null note default", async () => {
    const builder = queryBuilder({ data: { id: "p1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useCreatePayment(), {
      wrapper: createWrapper(),
    });

    const created = await actAsync(() =>
      result.current.mutateAsync({
        groupId: "g1",
        paidBy: "u1",
        paidTo: "u2",
        amount: 5,
      })
    );

    expect(created).toEqual({ id: "p1" });
    expect(mockedSupabase.from).toHaveBeenCalledWith("payments");
    expect(builder.insert).toHaveBeenCalledWith({
      group_id: "g1",
      paid_by: "u1",
      paid_to: "u2",
      amount: 5,
      note: null,
    });
  });

  it("forwards a provided note", async () => {
    const builder = queryBuilder({ data: { id: "p1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useCreatePayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        groupId: "g1",
        paidBy: "u1",
        paidTo: "u2",
        amount: 5,
        note: "rent",
      })
    );

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ note: "rent" })
    );
  });

  it("propagates insert errors", async () => {
    const builder = queryBuilder({ data: null, error: new Error("insert failed") });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useCreatePayment(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          paidBy: "u1",
          paidTo: "u2",
          amount: 5,
        })
      )
    ).rejects.toThrow("insert failed");
  });
});
