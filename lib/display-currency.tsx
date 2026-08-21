import React, { createContext, useContext, useMemo } from "react";
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

  const value = useMemo(
    () => ({ currency, setCurrency: setCurrencyState, loading }),
    [currency, setCurrencyState, loading]
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): DisplayCurrencyValue {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error(
      "useDisplayCurrency must be used within a DisplayCurrencyProvider"
    );
  }
  return ctx;
}
