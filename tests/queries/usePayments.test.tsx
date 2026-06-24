import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient } from "@tanstack/react-query";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import {
  useCreatePayment,
  useDeletePayment,
  useGroupPayments,
  useUpdatePayment,
} from "@/lib/queries/usePayments";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const mockedSupabase = supabase as unknown as { from: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useGroupPayments", () => {
  it("fetches payments for a group with both profile joins, filtered and ordered", async () => {
    const payments = [{ id: "p1" }, { id: "p2" }];
    const builder = queryBuilder({ data: payments, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useGroupPayments("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedSupabase.from).toHaveBeenCalledWith("payments");
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("payer:profiles!payments_paid_by_fkey")
    );
    expect(builder.select).toHaveBeenCalledWith(
      expect.stringContaining("payee:profiles!payments_paid_to_fkey")
    );
    expect(builder.eq).toHaveBeenCalledWith("group_id", "g1");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result.current.data).toEqual(payments);
  });

  it("does not run the query without a group id", async () => {
    const builder = queryBuilder({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useGroupPayments(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it("propagates query errors", async () => {
    const builder = queryBuilder({ data: null, error: new Error("boom") });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useGroupPayments("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("boom"));
  });
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
      currency: "USD",
      exchange_rate: 1,
      base_amount: 5,
    });
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

describe("useUpdatePayment", () => {
  it("updates a payment with mapped direction, amount, and note", async () => {
    const builder = queryBuilder({ data: { id: "p1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useUpdatePayment(), {
      wrapper: createWrapper(),
    });

    const updated = await actAsync(() =>
      result.current.mutateAsync({
        paymentId: "p1",
        groupId: "g1",
        paidBy: "u2",
        paidTo: "u1",
        amount: 7,
        note: "venmo",
      })
    );

    expect(updated).toEqual({ id: "p1" });
    expect(mockedSupabase.from).toHaveBeenCalledWith("payments");
    expect(builder.update).toHaveBeenCalledWith({
      paid_by: "u2",
      paid_to: "u1",
      amount: 7,
      note: "venmo",
      base_amount: 7,
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "p1");
  });

  it("invalidates the group pairwise roster so it live-refreshes on edit", async () => {
    const builder = queryBuilder({ data: { id: "p1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);
    const invalidateSpy = jest.spyOn(
      QueryClient.prototype,
      "invalidateQueries"
    );

    const { result } = await renderHook(() => useUpdatePayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        paymentId: "p1",
        groupId: "g1",
        paidBy: "u1",
        paidTo: "u2",
        amount: 7,
      })
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["group-pairwise-all", "g1"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["group-simplified", "g1"],
    });
    invalidateSpy.mockRestore();
  });
});

describe("useDeletePayment", () => {
  it("deletes by payment id", async () => {
    const builder = queryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeletePayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ paymentId: "p1", groupId: "g1" })
    );

    expect(mockedSupabase.from).toHaveBeenCalledWith("payments");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "p1");
  });
});
