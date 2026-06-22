import { renderHook, waitFor, act } from "@testing-library/react-native";
import {
  DEFAULT_NOTIFICATION_PREFS,
  useNotificationPrefs,
} from "@/lib/notifications";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe("useNotificationPrefs", () => {
  it("starts with defaults and clears loading once storage resolves", async () => {
    const { result } = await renderHook(() => useNotificationPrefs());

    expect(result.current.prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("merges stored preferences over the defaults", async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ paymentReminders: true, pushEnabled: false })
    );

    const { result } = await renderHook(() => useNotificationPrefs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prefs).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      paymentReminders: true,
      pushEnabled: false,
    });
  });

  it("ignores malformed stored JSON", async () => {
    mockGetItem.mockResolvedValue("{not json");

    const { result } = await renderHook(() => useNotificationPrefs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("updates a single preference and persists it", async () => {
    const { result } = await renderHook(() => useNotificationPrefs());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setPref("settlements", false);
    });

    expect(result.current.prefs.settlements).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith(
      "@splitbill/notification-prefs",
      JSON.stringify({ ...DEFAULT_NOTIFICATION_PREFS, settlements: false })
    );
  });
});
