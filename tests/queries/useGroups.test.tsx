import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient } from "@tanstack/react-query";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useGroups,
  useGroup,
  useCreateGroup,
  useCheckEmailExists,
  useCheckGroupMemberEmail,
  useLeaveGroup,
  useAddGroupMembers,
  useRenameGroup,
} from "@/lib/queries/useGroups";

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

describe("useGroups", () => {
  it("returns an empty list without a second query when there are no memberships", async () => {
    mockedSupabase.from.mockReturnValue(queryBuilder({ data: [], error: null }));

    const { result } = await renderHook(() => useGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.from).toHaveBeenCalledWith("group_members");
  });

  it("fetches groups for the member's group ids", async () => {
    const membershipsBuilder = queryBuilder({
      data: [{ group_id: "g1" }, { group_id: "g2" }],
      error: null,
    });
    const groupsBuilder = queryBuilder({
      data: [{ id: "g1", name: "Trip" }],
      error: null,
    });
    mockedSupabase.from
      .mockReturnValueOnce(membershipsBuilder)
      .mockReturnValueOnce(groupsBuilder);

    const { result } = await renderHook(() => useGroups(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "g1", name: "Trip" }]);
    expect(groupsBuilder.in).toHaveBeenCalledWith("id", ["g1", "g2"]);
  });
});

describe("useGroup", () => {
  it("fetches a single group by id", async () => {
    const group = { id: "g1", name: "Trip" };
    const builder = queryBuilder({ data: group, error: null });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useGroup("g1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(group);
    expect(builder.eq).toHaveBeenCalledWith("id", "g1");
    expect(builder.single).toHaveBeenCalled();
  });

});

describe("useLeaveGroup", () => {
  it("calls the leave_group RPC", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useLeaveGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync("g1"));

    expect(mockedSupabase.rpc).toHaveBeenCalledWith("leave_group", {
      p_group_id: "g1",
    });
  });

  it("propagates RPC errors", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error("cannot leave"),
    });

    const { result } = await renderHook(() => useLeaveGroup(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync("g1"))
    ).rejects.toThrow("cannot leave");
  });

  it("invalidates contact surfaces so group-mates drop off after leaving", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const invalidateSpy = jest.spyOn(
      QueryClient.prototype,
      "invalidateQueries"
    );

    const { result } = await renderHook(() => useLeaveGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync("g1"));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["contacts"] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["contact-balance"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["contact-group-breakdown"],
    });
    invalidateSpy.mockRestore();
  });
});

describe("useCreateGroup", () => {
  it("passes the invited emails straight to create_group_with_members", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: { id: "g1" },
      error: null,
    });

    const { result } = await renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        name: "Trip",
        memberEmails: ["a@x.com", " A@X.com "],
        currency: "EUR",
      })
    );

    // Normalising, deduping and resolving the addresses is the RPC's job now,
    // so the hook makes a single call and never handles a user id.
    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "create_group_with_members",
      {
        p_name: "Trip",
        p_member_emails: ["a@x.com", " A@X.com "],
        p_currency: "EUR",
      }
    );
  });

  it("defaults the currency to USD", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: { id: "g1" },
      error: null,
    });

    const { result } = await renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ name: "Solo", memberEmails: [] })
    );

    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "create_group_with_members",
      { p_name: "Solo", p_member_emails: [], p_currency: "USD" }
    );
  });

  it("surfaces the RPC error when an invited email has no account", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "No SplitBill account found for: ghost@x.com" },
    });

    const { result } = await renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          name: "Trip",
          memberEmails: ["ghost@x.com"],
        })
      )
    ).rejects.toThrow("No SplitBill account found for: ghost@x.com");
  });
});

describe("useAddGroupMembers", () => {
  it("passes the invited emails straight to add_group_members", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        groupId: "g1",
        memberEmails: ["a@x.com"],
      })
    );

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("add_group_members", {
      p_group_id: "g1",
      p_member_emails: ["a@x.com"],
    });
  });

  it("surfaces the RPC error when an invited email has no account", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "No SplitBill account found for: ghost@x.com" },
    });

    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          memberEmails: ["ghost@x.com"],
        })
      )
    ).rejects.toThrow("No SplitBill account found for: ghost@x.com");
  });

  it("surfaces the RPC error when someone is already in the group", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Already in this group: bob@x.com" },
    });

    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          memberEmails: ["bob@x.com"],
        })
      )
    ).rejects.toThrow("Already in this group: bob@x.com");
  });
});

describe("useRenameGroup", () => {
  it("calls rename_group with the group id and name", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: { id: "g1", name: "Ski Trip" },
      error: null,
    });

    const { result } = await renderHook(() => useRenameGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ groupId: "g1", name: "Ski Trip" })
    );

    expect(mockedSupabase.rpc).toHaveBeenCalledWith("rename_group", {
      p_group_id: "g1",
      p_name: "Ski Trip",
    });
  });

  it("propagates RPC errors", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "You are not a member of this group" },
    });

    const { result } = await renderHook(() => useRenameGroup(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({ groupId: "g1", name: "X" })
      )
    ).rejects.toThrow("You are not a member of this group");
  });
});

describe("useCheckEmailExists", () => {
  it("returns true when the email resolves to an account", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ email: "a@x.com" }],
      error: null,
    });

    const { result } = await renderHook(() => useCheckEmailExists(), {
      wrapper: createWrapper(),
    });

    const exists = await actAsync(() => result.current.mutateAsync("a@x.com"));
    expect(exists).toBe(true);
    // The lookup returns matched addresses only -- never a user id.
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("check_emails_registered", {
      p_emails: ["a@x.com"],
    });
  });

  it("returns false when the email has no account", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = await renderHook(() => useCheckEmailExists(), {
      wrapper: createWrapper(),
    });

    const exists = await actAsync(() =>
      result.current.mutateAsync("ghost@x.com")
    );
    expect(exists).toBe(false);
  });
});

describe("useCheckGroupMemberEmail", () => {
  it.each(["ok", "not_registered", "already_member"] as const)(
    "returns %s straight from the RPC",
    async (status) => {
      mockedSupabase.rpc.mockResolvedValue({ data: status, error: null });

      const { result } = await renderHook(() => useCheckGroupMemberEmail(), {
        wrapper: createWrapper(),
      });

      const got = await actAsync(() =>
        result.current.mutateAsync({ groupId: "g1", email: "a@x.com" })
      );

      expect(got).toBe(status);
      expect(mockedSupabase.rpc).toHaveBeenCalledWith(
        "check_group_member_email",
        { p_group_id: "g1", p_email: "a@x.com" }
      );
    }
  );

  it("throws when the caller is not in the group", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "You are not a member of this group" },
    });

    const { result } = await renderHook(() => useCheckGroupMemberEmail(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({ groupId: "g1", email: "a@x.com" })
      )
    ).rejects.toThrow("You are not a member of this group");
  });
});
