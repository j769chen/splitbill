import { renderHook, waitFor } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

import {
  useSendContactRequest,
  useContactRequests,
  useRespondContactRequest,
  useCancelContactRequest,
} from "@/lib/queries/useContactRequests";

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
