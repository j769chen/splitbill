import * as SecureStore from "expo-secure-store";
import { ExpoSecureStoreAdapter } from "@/lib/supabase";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

const mockedSecureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

describe("ExpoSecureStoreAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns SecureStore promises for all storage operations", () => {
    const getPromise = Promise.resolve("session");
    const setPromise = Promise.resolve();
    const removePromise = Promise.resolve();
    mockedSecureStore.getItemAsync.mockReturnValue(getPromise);
    mockedSecureStore.setItemAsync.mockReturnValue(setPromise);
    mockedSecureStore.deleteItemAsync.mockReturnValue(removePromise);

    expect(ExpoSecureStoreAdapter.getItem("sb-key")).toBe(getPromise);
    expect(ExpoSecureStoreAdapter.setItem("sb-key", "value")).toBe(setPromise);
    expect(ExpoSecureStoreAdapter.removeItem("sb-key")).toBe(removePromise);
  });
});
