import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import {
  DisplayCurrencyProvider,
  useDisplayCurrency,
} from "@/lib/display-currency";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <DisplayCurrencyProvider>{children}</DisplayCurrencyProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe("useDisplayCurrency", () => {
  it("defaults to USD and persists a change", async () => {
    const { result } = await renderHook(() => useDisplayCurrency(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currency).toBe("USD");

    await act(async () => {
      result.current.setCurrency("EUR");
    });

    expect(result.current.currency).toBe("EUR");
    expect(mockSetItem).toHaveBeenCalledWith(
      "@splitbill/display-currency",
      "EUR"
    );
  });

  it("ignores an unsupported stored currency", async () => {
    mockGetItem.mockResolvedValue("ZZZ");

    const { result } = await renderHook(() => useDisplayCurrency(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currency).toBe("USD");
  });

  it("throws when used outside its provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(renderHook(() => useDisplayCurrency())).rejects.toThrow(
      "useDisplayCurrency must be used within a DisplayCurrencyProvider"
    );

    spy.mockRestore();
  });
});
