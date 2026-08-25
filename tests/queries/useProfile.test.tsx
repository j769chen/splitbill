import { renderHook } from "@testing-library/react-native";
import { QueryClient } from "@tanstack/react-query";
import { actAsync, createWrapper } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { updateUser: jest.fn() } },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));

const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  rpc: jest.Mock;
  auth: { updateUser: jest.Mock };
};
const mockedUseAuth = useAuth as unknown as jest.Mock;

const refreshUser = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { id: "user-1" }, refreshUser });
});

describe("useUpdateProfile", () => {
  it("updates the profile through the RPC and the auth user metadata", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync({ fullName: "New Name" }));

    // The row is written by a SECURITY DEFINER RPC that scopes the update to
    // the caller, so the client no longer sends its own user id.
    expect(mockedSupabase.rpc).toHaveBeenCalledWith("update_profile", {
      p_full_name: "New Name",
    });
    expect(mockedSupabase.from).not.toHaveBeenCalled();
    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: "New Name" },
    });
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("propagates a profile update error before touching auth", async () => {
    mockedSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Name is required" },
    });

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync({ fullName: "New Name" }))
    ).rejects.toThrow("Name is required");

    expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("propagates an auth metadata update error", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockedSupabase.auth.updateUser.mockResolvedValue({
      data: {},
      error: new Error("auth down"),
    });

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync({ fullName: "New Name" }))
    ).rejects.toThrow("auth down");
  });

  it("invalidates every list that denormalises the display name", async () => {
    mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const invalidateSpy = jest.spyOn(
      QueryClient.prototype,
      "invalidateQueries"
    );

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync({ fullName: "New Name" }));

    for (const key of [
      "groups",
      "group",
      "expenses",
      "payments",
      "balances",
      "contacts",
      "contact-expenses",
      "contact-payments",
      "activity",
      "activity-payments",
      "contact-activity",
      "contact-payments-activity",
    ]) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [key] });
    }
    invalidateSpy.mockRestore();
  });
});
