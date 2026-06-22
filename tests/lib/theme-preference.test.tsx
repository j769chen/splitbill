import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme } from "@/lib/theme";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/lib/theme-preference";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: jest.fn(() => "light"),
}));

const mockedColorScheme = useColorScheme as unknown as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemePreferenceProvider>{children}</ThemePreferenceProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockedColorScheme.mockReturnValue("light");
});

describe("useThemePreference", () => {
  it("defaults to system mode and follows a light system scheme", async () => {
    const { result } = await renderHook(() => useThemePreference(), { wrapper });

    expect(result.current.mode).toBe("system");
    expect(result.current.isDark).toBe(false);
    expect(result.current.theme).toBe(lightTheme);
  });

  it("uses the dark theme when the system scheme is dark", async () => {
    mockedColorScheme.mockReturnValue("dark");

    const { result } = await renderHook(() => useThemePreference(), { wrapper });

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe(darkTheme);
  });

  it("loads a stored explicit mode", async () => {
    mockGetItem.mockResolvedValue("dark");

    const { result } = await renderHook(() => useThemePreference(), { wrapper });

    await waitFor(() => expect(result.current.mode).toBe("dark"));
    expect(result.current.isDark).toBe(true);
  });

  it("setMode updates state and persists the choice", async () => {
    const { result } = await renderHook(() => useThemePreference(), { wrapper });

    await act(async () => {
      result.current.setMode("light");
    });

    expect(result.current.mode).toBe("light");
    expect(result.current.isDark).toBe(false);
    expect(mockSetItem).toHaveBeenCalledWith("@splitbill/theme-mode", "light");
  });

  it("throws when used outside of a provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(renderHook(() => useThemePreference())).rejects.toThrow();
    spy.mockRestore();
  });
});
