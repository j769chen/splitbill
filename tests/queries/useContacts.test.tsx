import { renderHook, waitFor } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useContacts,
  useContactBalance,
  useContactExpenses,
  useContactGroupBreakdown,
  useSendContactRequest,
  useContactRequests,
  useRespondContactRequest,
  useCancelContactRequest,
  useCreateContactExpense,
  useUpdateContactExpense,
  useDeleteContactExpense,
  useContactPayments,
  useCreateContactPayment,
  useUpdateContactPayment,
  useDeleteContactPayment,
} from "@/lib/queries/useContacts";

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

describe("useContacts", () => {
  it("returns contacts with numeric balances from the RPC", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        {
          contact_user_id: "user-2",
          full_name: "Bob",
          avatar_url: null,
          balance: "12.5",
        },
      ],
      error: null,
    });

    const { result } = await renderHook(() => useContacts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "get_contacts_with_combined_balances"
    );
    expect(result.current.data).toEqual([
      {
        contact_user_id: "user-2",
        full_name: "Bob",
        avatar_url: null,
        balance: 12.5,
      },
    ]);
  });

});

describe("useContactBalance", () => {
  it("returns the numeric balance for a contact", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: "-7.25", error: null });

    const { result } = await renderHook(() => useContactBalance("user-2"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "get_contact_combined_balance",
      {
        p_contact_user_id: "user-2",
      }
    );
    expect(result.current.data).toBe(-7.25);
  });
});

describe("useContactExpenses", () => {
  it("queries the normalized participant pair ordered by date", async () => {
    const rows = [{ id: "ce-1" }];
    const builder = queryBuilder({ data: rows, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useContactExpenses("user-2"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_expenses");
    expect(builder.eq).toHaveBeenCalledWith("user_lo", "user-1");
    expect(builder.eq).toHaveBeenCalledWith("user_hi", "user-2");
    expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    expect(result.current.data).toEqual(rows);
  });

  it("sorts the pair regardless of which id is larger", async () => {
    mockedUseAuth.mockReturnValue({ user: { id: "user-9" } });
    const builder = queryBuilder({ data: [], error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useContactExpenses("user-2"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(builder.eq).toHaveBeenCalledWith("user_lo", "user-2");
    expect(builder.eq).toHaveBeenCalledWith("user_hi", "user-9");
  });
});

describe("useContactGroupBreakdown", () => {
  it("returns per-group pairwise balances with numeric amounts", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        { group_id: "g1", group_name: "Ski Trip", balance: "25.5" },
        { group_id: "g2", group_name: "Roomies", balance: "-10" },
      ],
      error: null,
    });

    const { result } = await renderHook(
      () => useContactGroupBreakdown("user-2"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "get_contact_group_breakdown",
      { p_contact_user_id: "user-2" }
    );
    expect(result.current.data).toEqual([
      { group_id: "g1", group_name: "Ski Trip", balance: 25.5 },
      { group_id: "g2", group_name: "Roomies", balance: -10 },
    ]);
  });

});

describe("useSendContactRequest", () => {
  it("resolves the email then calls send_contact_request with the matched id", async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({
        data: [{ id: "user-2", email: "bob@x.com" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = await renderHook(() => useSendContactRequest(), {
      wrapper: createWrapper(),
    });

    const id = await actAsync(() => result.current.mutateAsync("  Bob@X.com "));

    expect(id).toBe("user-2");
    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(1, "get_user_ids_by_email", {
      emails: ["bob@x.com"],
    });
    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(2, "send_contact_request", {
      p_recipient_user_id: "user-2",
    });
  });

  it("surfaces the already-a-contact error raised by the RPC", async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({
        data: [{ id: "user-2", email: "bob@x.com" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "This person is already a contact" },
      });

    const { result } = await renderHook(() => useSendContactRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync("bob@x.com"))
    ).rejects.toThrow("This person is already a contact");

    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(2, "send_contact_request", {
      p_recipient_user_id: "user-2",
    });
  });

  it("throws and skips send_contact_request when no account is found", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    const { result } = await renderHook(() => useSendContactRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync("ghost@x.com"))
    ).rejects.toThrow("No SplitBill account found for ghost@x.com");

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("useContactRequests", () => {
  it("splits requests into incoming and outgoing with mapped profiles", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [
        {
          id: "req-1",
          direction: "incoming",
          status: "pending",
          created_at: "2026-01-02T00:00:00Z",
          user_id: "user-2",
          full_name: "Bob",
          avatar_url: null,
        },
        {
          id: "req-2",
          direction: "outgoing",
          status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          user_id: "user-3",
          full_name: "Carol",
          avatar_url: "http://img/c.png",
        },
      ],
      error: null,
    });

    const { result } = await renderHook(() => useContactRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_contact_requests");
    expect(result.current.data).toEqual({
      incoming: [
        {
          id: "req-1",
          direction: "incoming",
          status: "pending",
          created_at: "2026-01-02T00:00:00Z",
          profile: { id: "user-2", full_name: "Bob", avatar_url: null },
        },
      ],
      outgoing: [
        {
          id: "req-2",
          direction: "outgoing",
          status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          profile: {
            id: "user-3",
            full_name: "Carol",
            avatar_url: "http://img/c.png",
          },
        },
      ],
    });
  });

});

describe("useRespondContactRequest", () => {
  it("calls respond_contact_request with the request id and accept flag", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useRespondContactRequest(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ requestId: "req-1", accept: true })
    );

    expect(mockedSupabase.rpc).toHaveBeenCalledWith("respond_contact_request", {
      p_request_id: "req-1",
      p_accept: true,
    });
  });

  it("propagates RPC errors", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "This request has already been handled" },
    });

    const { result } = await renderHook(() => useRespondContactRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({ requestId: "req-1", accept: false })
      )
    ).rejects.toThrow("This request has already been handled");
  });
});

describe("useCancelContactRequest", () => {
  it("calls cancel_contact_request with the request id", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useCancelContactRequest(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync("req-1"));

    expect(mockedSupabase.rpc).toHaveBeenCalledWith("cancel_contact_request", {
      p_request_id: "req-1",
    });
  });
});

describe("useCreateContactExpense", () => {
  it("rejects when split amounts do not add up to the total", async () => {
    const { result } = await renderHook(() => useCreateContactExpense(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          contactUserId: "user-2",
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

  it("calls create_contact_expense_with_splits with mapped params", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: { id: "ce-1" }, error: null });

    const { result } = await renderHook(() => useCreateContactExpense(), {
      wrapper: createWrapper(),
    });

    const created = await actAsync(() =>
      result.current.mutateAsync({
        contactUserId: "user-2",
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

    expect(created).toEqual({ id: "ce-1" });
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "create_contact_expense_with_splits",
      {
        p_contact_user_id: "user-2",
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

});

describe("useDeleteContactExpense", () => {
  it("deletes the contact expense by id", async () => {
    const builder = queryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useDeleteContactExpense(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ expenseId: "ce-1", contactUserId: "user-2" })
    );

    expect(mockedSupabase.from).toHaveBeenCalledWith("contact_expenses");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "ce-1");
  });

});

describe("useUpdateContactExpense", () => {

  it("calls update_contact_expense_with_splits with mapped params", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: { id: "ce-1" }, error: null });

    const { result } = await renderHook(() => useUpdateContactExpense(), {
      wrapper: createWrapper(),
    });

    const updated = await actAsync(() =>
      result.current.mutateAsync({
        expenseId: "ce-1",
        contactUserId: "user-2",
        paidBy: "user-2",
        amount: 10,
        description: "Dinner",
        splitType: "equal",
        splits: [
          { userId: "user-1", amount: 5 },
          { userId: "user-2", amount: 5 },
        ],
      })
    );

    expect(updated).toEqual({ id: "ce-1" });
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "update_contact_expense_with_splits",
      {
        p_expense_id: "ce-1",
        p_paid_by: "user-2",
        p_amount: 10,
        p_description: "Dinner",
        p_category: null,
        p_split_type: "equal",
        p_splits: [
          { userId: "user-1", amount: 5 },
          { userId: "user-2", amount: 5 },
        ],
        p_date: null,
      }
    );
  });
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
    });
    expect(builder.eq).toHaveBeenCalledWith("id", "cp-1");
  });
});

describe("useDeleteContactPayment", () => {
  it("deletes the contact payment by id", async () => {
    const builder = queryBuilder({ data: null, error: null });
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

});
