import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExchangeRates } from "./currency";

const RATES_STORAGE_KEY = "@splitbill/exchange-rates";
const RATES_URL = "https://open.er-api.com/v6/latest/USD";

interface CachedRates {
  rates: ExchangeRates;
  fetchedAt: number;
}

async function readCachedRates(): Promise<CachedRates | null> {
  try {
    const raw = await AsyncStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (parsed && parsed.rates && typeof parsed.rates === "object") {
      return parsed;
    }
  } catch {
    // Ignore malformed cache.
  }
  return null;
}

async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch(RATES_URL);
    if (response.ok) {
      const json = (await response.json()) as {
        result?: string;
        rates?: ExchangeRates;
      };
      if (json.result === "success" && json.rates) {
        await AsyncStorage.setItem(
          RATES_STORAGE_KEY,
          JSON.stringify({ rates: json.rates, fetchedAt: Date.now() })
        );
        return json.rates;
      }
    }
  } catch {
    // Network failure: fall through to cached rates.
  }

  const cached = await readCachedRates();
  if (cached) return cached.rates;

  // Last resort so the app still functions offline with no cache.
  return { USD: 1 };
}

// Cached exchange rates keyed to USD. Refetched at most twice a day; persisted
// to AsyncStorage so conversions still work offline.
export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: fetchExchangeRates,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  });
}
