import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useAsyncStorageState } from "@/lib/useAsyncStorageState";

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

describe("useAsyncStorageState", () => {
  it("starts with the initial value and clears loading after storage resolves", async () => {
    const { result } = await renderHook(() =>
      useAsyncStorageState({
        key: "@splitbill/test",
        initialValue: "system",
      })
    );

    expect(result.current.value).toBe("system");
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("uses a deserialized stored value when one exists", async () => {
    mockGetItem.mockResolvedValue("dark");

    const { result } = await renderHook(() =>
      useAsyncStorageState({
        key: "@splitbill/test",
        initialValue: "system",
        deserialize: (raw) => (raw === "dark" ? raw : "system"),
      })
    );

    await waitFor(() => expect(result.current.value).toBe("dark"));
  });

  it("keeps the current value when deserialization fails", async () => {
    mockGetItem.mockResolvedValue("{not json");

    const { result } = await renderHook(() =>
      useAsyncStorageState({
        key: "@splitbill/test",
        initialValue: { enabled: true },
        deserialize: (raw) => JSON.parse(raw) as { enabled: boolean },
        serialize: JSON.stringify,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toEqual({ enabled: true });
  });

  it("updates state with an updater function and persists the serialized value", async () => {
    const { result } = await renderHook(() =>
      useAsyncStorageState({
        key: "@splitbill/test",
        initialValue: { enabled: true },
        serialize: JSON.stringify,
      })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setValue((prev) => ({ ...prev, enabled: false }));
    });

    expect(result.current.value).toEqual({ enabled: false });
    expect(mockSetItem).toHaveBeenCalledWith(
      "@splitbill/test",
      JSON.stringify({ enabled: false })
    );
  });
});
