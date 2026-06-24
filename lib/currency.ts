export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Supported currencies. `symbol` is rendered before the amount; `decimals`
// controls the number of fraction digits (most are 2, JPY/KRW are 0).
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  { code: "CHF", symbol: "CHF ", name: "Swiss Franc", decimals: 2 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", decimals: 0 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", decimals: 2 },
  { code: "SEK", symbol: "kr ", name: "Swedish Krona", decimals: 2 },
  { code: "NOK", symbol: "kr ", name: "Norwegian Krone", decimals: 2 },
  { code: "DKK", symbol: "kr ", name: "Danish Krone", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2 },
  { code: "AED", symbol: "AED ", name: "UAE Dirham", decimals: 2 },
];

export type CurrencyCode = string;

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  return (
    CURRENCY_BY_CODE.get(code) ?? {
      code,
      symbol: `${code} `,
      name: code,
      decimals: 2,
    }
  );
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return getCurrencyInfo(code).symbol;
}

export function getCurrencyDecimals(code: CurrencyCode): number {
  return getCurrencyInfo(code).decimals;
}

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && CURRENCY_BY_CODE.has(code);
}

// Rates are expressed as "units of currency per 1 USD" (open.er-api.com base).
export type ExchangeRates = Record<string, number>;

// Multiplier to convert an amount in `from` into `to`:
//   amountInTo = amountInFrom * getRate(from, to, rates)
export function getRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates | undefined
): number {
  if (from === to) return 1;
  if (!rates) return 1;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return 1;
  return toRate / fromRate;
}

export function canConvert(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates | undefined
): boolean {
  if (from === to) return true;
  return !!rates?.[from] && !!rates?.[to];
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates | undefined
): number {
  return amount * getRate(from, to, rates);
}
