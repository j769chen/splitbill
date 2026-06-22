import { renderHook } from "@testing-library/react-native";
import { actAsync, createWrapper, queryBuilder } from "../helpers/testUtils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), auth: { updateUser: jest.fn() } },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));

const mockedSupabase = supabase as unknown as {
  from: jest.Mock;
  auth: { updateUser: jest.Mock };
};
const mockedUseAuth = useAuth as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { id: "user-1" } });
});

describe("useUpdateProfile", () => {
  it("updates the profile row and the auth user metadata", async () => {
    const builder = queryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder);
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await actAsync(() => result.current.mutateAsync({ fullName: "New Name" }));

    expect(mockedSupabase.from).toHaveBeenCalledWith("profiles");
    expect(builder.update).toHaveBeenCalledWith({ full_name: "New Name" });
    expect(builder.eq).toHaveBeenCalledWith("id", "user-1");
    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: "New Name" },
    });
  });

  it("propagates a profile update error before touching auth", async () => {
    const builder = queryBuilder({ data: null, error: new Error("db down") });
    mockedSupabase.from.mockReturnValue(builder);

    const { result } = await renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    await expect(
      actAsync(() => result.current.mutateAsync({ fullName: "New Name" }))
    ).rejects.toThrow("db down");

    expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("propagates an auth metadata update error", async () => {
    const builder = queryBuilder({ data: null, error: null });
    mockedSupabase.from.mockReturnValue(builder);
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
});
