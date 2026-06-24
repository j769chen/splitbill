import { renderHook, waitFor } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  useGroups,
  useGroup,
  useCreateGroup,
  useCheckEmailExists,
  useLookupUserByEmail,
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
});

describe("useCreateGroup", () => {
  it("dedupes emails, excludes the creator, and calls the RPC with invitee ids", async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({
        data: [
          { id: "u2", email: "a@x.com" },
          { id: "u2", email: "a@x.com" },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: "g1" }, error: null });

    const { result } = await renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        name: "Trip",
        memberEmails: ["a@x.com", "me@x.com", " A@X.com "],
      })
    );

    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(
      1,
      "get_user_ids_by_email",
      { emails: ["a@x.com"] }
    );
    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(
      2,
      "create_group_with_members",
      { p_name: "Trip", p_member_ids: ["u2"] }
    );
  });

  it("skips the email lookup when no members are invited", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: { id: "g1" }, error: null });

    const { result } = await renderHook(() => useCreateGroup(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({ name: "Solo", memberEmails: [] })
    );

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith(
      "create_group_with_members",
      { p_name: "Solo", p_member_ids: [] }
    );
  });

  it("throws when an invited email has no account and does not create the group", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

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

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("useAddGroupMembers", () => {
  it("resolves emails and calls add_group_members with member ids", async () => {
    mockedSupabase.rpc
      .mockResolvedValueOnce({
        data: [{ id: "u2", email: "a@x.com" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await actAsync(() =>
      result.current.mutateAsync({
        groupId: "g1",
        memberEmails: ["a@x.com", "me@x.com", " A@X.com "],
      })
    );

    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(
      1,
      "get_user_ids_by_email",
      { emails: ["a@x.com"] }
    );
    expect(mockedSupabase.rpc).toHaveBeenNthCalledWith(2, "add_group_members", {
      p_group_id: "g1",
      p_member_ids: ["u2"],
    });
  });

  it("throws when no emails resolve to invitees", async () => {
    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({ groupId: "g1", memberEmails: ["me@x.com"] })
      )
    ).rejects.toThrow("Add at least one other person's email");

    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
  });

  it("throws when an invited email has no account", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

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

    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("blocks an email that resolves to an existing group member", async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({
      data: [{ id: "u2", email: "bob@x.com" }],
      error: null,
    });

    const { result } = await renderHook(() => useAddGroupMembers(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() =>
        result.current.mutateAsync({
          groupId: "g1",
          memberEmails: ["bob@x.com"],
          existingMemberIds: ["u1", "u2"],
        })
      )
    ).rejects.toThrow("Already in this group: bob@x.com");

    // Only the email lookup runs; the add RPC is never reached.
    expect(mockedSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_user_ids_by_email", {
      emails: ["bob@x.com"],
    });
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
      data: [{ id: "u2", email: "a@x.com" }],
      error: null,
    });

    const { result } = await renderHook(() => useCheckEmailExists(), {
      wrapper: createWrapper(),
    });

    const exists = await actAsync(() => result.current.mutateAsync("a@x.com"));
    expect(exists).toBe(true);
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

describe("useLookupUserByEmail", () => {
  it("returns the matched account row for an email", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: [{ id: "u2", email: "a@x.com" }],
      error: null,
    });

    const { result } = await renderHook(() => useLookupUserByEmail(), {
      wrapper: createWrapper(),
    });

    const profile = await actAsync(() => result.current.mutateAsync("a@x.com"));
    expect(profile).toEqual({ id: "u2", email: "a@x.com" });
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("get_user_ids_by_email", {
      emails: ["a@x.com"],
    });
  });

  it("returns null when the email has no account", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = await renderHook(() => useLookupUserByEmail(), {
      wrapper: createWrapper(),
    });

    const profile = await actAsync(() =>
      result.current.mutateAsync("ghost@x.com")
    );
    expect(profile).toBeNull();
  });
});
