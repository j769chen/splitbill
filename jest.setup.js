// Deterministic exchange rates (keyed to USD) so currency conversion is stable
// in tests and no network request is made.
jest.mock("@/lib/exchange-rates", () => ({
  __esModule: true,
  useExchangeRates: () => ({
    data: { USD: 1, EUR: 0.5, GBP: 0.8, JPY: 100, CAD: 1.25 },
    isLoading: false,
    isSuccess: true,
  }),
}));

// In-memory mock for AsyncStorage so modules that touch local storage can be
// imported/tested without the native module.
jest.mock("@react-native-async-storage/async-storage", () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) =>
        Promise.resolve(key in store ? store[key] : null)
      ),
      setItem: jest.fn((key, value) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});
