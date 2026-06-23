import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/lib/realtime";

const mockOn = jest.fn();
const mockSubscribe = jest.fn();
const mockChannelFn = jest.fn();
const mockGetChannels = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannelFn(...args),
    getChannels: (...args: unknown[]) => mockGetChannels(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

const channelObj = { on: mockOn, subscribe: mockSubscribe };

function makeWrapper() {
  const queryClient = new QueryClient();
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockImplementation(() => Promise.resolve());
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, invalidate };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOn.mockReturnValue(channelObj);
  mockSubscribe.mockReturnValue(channelObj);
  mockChannelFn.mockReturnValue(channelObj);
  mockGetChannels.mockReturnValue([]);
});

describe("useRealtimeSubscription", () => {
  it("does nothing when no group id is provided", async () => {
    const { Wrapper } = makeWrapper();

    await renderHook(() => useRealtimeSubscription(undefined), {
      wrapper: Wrapper,
    });

    expect(mockChannelFn).not.toHaveBeenCalled();
  });

  it("removes stale channels for the group before subscribing", async () => {
    const stale = { topic: "realtime:group-g1-0" };
    const other = { topic: "realtime:group-other-0" };
    mockGetChannels.mockReturnValue([stale, other]);
    const { Wrapper } = makeWrapper();

    await renderHook(() => useRealtimeSubscription("g1"), { wrapper: Wrapper });

    expect(mockRemoveChannel).toHaveBeenCalledWith(stale);
    expect(mockRemoveChannel).not.toHaveBeenCalledWith(other);
    expect(mockChannelFn).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledTimes(4);
  });

  it("invalidates the relevant queries when a change event fires", async () => {
    const { Wrapper, invalidate } = makeWrapper();

    await renderHook(() => useRealtimeSubscription("g1"), { wrapper: Wrapper });

    // The first registration is for the expenses table.
    const expensesHandler = mockOn.mock.calls[0][2] as () => void;
    expensesHandler();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["expenses", "g1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["balances", "g1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["total-balance"] });
    // Group activity feeds combined contact balances, so contact queries refresh.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["contacts"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["contact-balance"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["contact-group-breakdown"],
    });

    // The last registration is for group_members.
    const membersHandler = mockOn.mock.calls[3][2] as () => void;
    membersHandler();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["group", "g1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["groups"] });
  });

  it("removes the channel on unmount", async () => {
    const { Wrapper } = makeWrapper();

    const { unmount } = await renderHook(() => useRealtimeSubscription("g1"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      unmount();
    });
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj);
  });
});
