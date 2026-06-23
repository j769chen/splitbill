import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { actAsync } from "../helpers/testUtils";
import { AuthProvider, useAuth } from "@/lib/auth";

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockSignUp.mockResolvedValue({ error: null });
  mockSignInWithPassword.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
});

describe("AuthProvider / useAuth", () => {
  it("starts loading then resolves to no session", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("exposes the user from an existing session", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1", email: "a@x.com" } } },
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user).toEqual({ id: "u1", email: "a@x.com" });
  });

  it("signUp forwards credentials and metadata", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    const res = await actAsync(() =>
      result.current.signUp("a@x.com", "pw123", "Alice")
    );

    expect(res).toEqual({ error: null });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "a@x.com",
      password: "pw123",
      options: { data: { full_name: "Alice" } },
    });
  });

  it("signIn forwards credentials", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await actAsync(() => result.current.signIn("a@x.com", "pw123"));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "a@x.com",
      password: "pw123",
    });
  });

  it("signOut delegates to supabase", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await actAsync(() => result.current.signOut());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("updates session when the auth state changes", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const onChange = mockOnAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown
    ) => void;

    await act(async () => {
      onChange("SIGNED_IN", { user: { id: "u2" } });
    });

    expect(result.current.user).toEqual({ id: "u2" });
  });

  it("refreshUser merges the latest user into the session", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1" }, access_token: "tok" } },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", user_metadata: { full_name: "New Name" } } },
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await actAsync(() => result.current.refreshUser());

    expect(result.current.user).toEqual({
      id: "u1",
      user_metadata: { full_name: "New Name" },
    });
    expect(result.current.session).toEqual({
      user: { id: "u1", user_metadata: { full_name: "New Name" } },
      access_token: "tok",
    });
  });

  it("refreshUser is a no-op when no user is returned", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1" }, access_token: "tok" } },
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await actAsync(() => result.current.refreshUser());

    expect(result.current.user).toEqual({ id: "u1" });
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = await renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      unmount();
    });

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
