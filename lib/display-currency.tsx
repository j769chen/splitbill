import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  DEFAULT_CURRENCY,
  isSupportedCurrency,
  type CurrencyCode,
} from "./currency";
import { useAsyncStorageState } from "./useAsyncStorageState";

interface DisplayCurrencyValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  loading: boolean;
}

const STORAGE_KEY = "@splitbill/display-currency";

const DisplayCurrencyContext = createContext<DisplayCurrencyValue | null>(null);

function deserializeCurrency(raw: string): CurrencyCode {
  return isSupportedCurrency(raw) ? raw : DEFAULT_CURRENCY;
}

export function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    value: currency,
    setValue: setCurrencyState,
    loading,
  } = useAsyncStorageState<CurrencyCode>({
    key: STORAGE_KEY,
    initialValue: DEFAULT_CURRENCY,
    deserialize: deserializeCurrency,
  });

  const setCurrency = useCallback(
    (next: CurrencyCode) => {
      setCurrencyState(next);
    },
    [setCurrencyState]
  );

  const value = useMemo(
    () => ({ currency, setCurrency, loading }),
    [currency, setCurrency, loading]
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

const FALLBACK_VALUE: DisplayCurrencyValue = {
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
  loading: false,
};

// Falls back to the default currency when no provider is mounted (e.g. in unit
// tests that render a component in isolation) rather than throwing.
export function useDisplayCurrency(): DisplayCurrencyValue {
  return useContext(DisplayCurrencyContext) ?? FALLBACK_VALUE;
}
