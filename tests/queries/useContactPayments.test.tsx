import { renderHook, waitFor } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

import {
  useContactPayments,
  useCreateContactPayment,
  useUpdateContactPayment,
  useDeleteContactPayment,
} from "@/lib/queries/useContactPayments";

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
  mockedUseAuth.mockReturnValue({ user: { id: "user-1", email: "me@x.com" } });
});

describe("useContactPayments", () => {
  it("queries the normalized participant pair ordered by created_at", async () => {
    const rows = [{ id: "cp-1" }];
    const builder = queryBuilder({ data: rows, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useContactPayments("user-2"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_payments");
    expect(builder.eq).toHaveBeenCalledWith("user_lo", "user-1");
    expect(builder.eq).toHaveBeenCalledWith("user_hi", "user-2");
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result.current.data).toEqual(rows);
  });
});

describe("useCreateContactPayment", () => {
  it("inserts a payment with the sorted participant pair", async () => {
    const builder = queryBuilder({ data: { id: "cp-1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useCreateContactPayment(), {
      wrapper: createWrapper(),
    });

    const created = await actAsync(() =>
      result.current.mutateAsync({
        contactUserId: "user-2",
        paidBy: "user-1",
        paidTo: "user-2",
        amount: 15,
        note: "venmo",
      })
    );

    expect(created).toEqual({ id: "cp-1" });
    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_payments");
    expect(builder.insert).toHaveBeenCalledWith({
      paid_by: "user-1",
      paid_to: "user-2",
      user_lo: "user-1",
      user_hi: "user-2",
      amount: 15,
      note: "venmo",
      currency: "USD",
      exchange_rate: 1,
      base_amount: 15,
    });
  });

  it("normalizes the pair regardless of direction", async () => {
    const builder = queryBuilder({ data: { id: "cp-1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useCreateContactPayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        contactUserId: "user-2",
        paidBy: "user-2",
        paidTo: "user-1",
        amount: 15,
      })
    );

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_lo: "user-1",
        user_hi: "user-2",
        note: null,
      })
    );
  });
});

describe("useUpdateContactPayment", () => {
  it("updates the payment direction, amount, and note by id", async () => {
    const builder = queryBuilder({ data: { id: "cp-1" }, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useUpdateContactPayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        paymentId: "cp-1",
        contactUserId: "user-2",
        paidBy: "user-2",
        paidTo: "user-1",
        amount: 8,
        note: "cash",
      })
    );

    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_payments");
    expect(builder.update).toHaveBeenCalledWith({
      paid_by: "user-2",
      paid_to: "user-1",
      amount: 8,
      note: "cash",
      base_amount: 8,
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "cp-1");
  });
});

describe("useDeleteContactPayment", () => {
  it("deletes the contact payment by id", async () => {
    const builder = queryBuilder({ data: [{ id: "cp-1" }], error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeleteContactPayment(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ paymentId: "cp-1", contactUserId: "user-2" })
    );

    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_payments");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "cp-1");
  });

  it("rejects when the delete removes no rows", async () => {
    const builder = queryBuilder({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeleteContactPayment(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ paymentId: "cp-1", contactUserId: "user-2" })
    ).rejects.toThrow("You can't delete this payment.");
  });
});
