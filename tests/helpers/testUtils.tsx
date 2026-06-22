import React, { ReactElement, ReactNode } from "react";
import { act, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import {
  QueryClient,
  QueryClientProvider,
  notifyManager,
} from "@tanstack/react-query";
import { lightTheme } from "@/lib/theme";

// Flush React Query notifications synchronously so observer state updates
// happen inside the awaited render/act scope, avoiding act(...) warnings.
notifyManager.setScheduler((cb) => cb());

/**
 * Runs an async mutation inside React's act() so the resulting observer state
 * updates (isPending -> isSuccess/isError) don't trigger act(...) warnings.
 */
export async function actAsync<T>(fn: () => Promise<T>): Promise<T> {
  let value: T;
  await act(async () => {
    value = await fn();
  });
  return value!;
}

/**
 * Renders a screen wrapped in PaperProvider (with the app's light theme) so
 * react-native-paper components and useAppTheme resolve correctly. render() is
 * async in RNTL v14, so callers must await this.
 */
export function renderWithPaper(ui: ReactElement) {
  return render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);
}

/**
 * Builds a React Query provider wrapper for renderHook. Retries are disabled so
 * rejected queries/mutations surface immediately instead of being retried.
 */
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

export interface SupabaseResult<T = unknown> {
  data: T;
  error: unknown;
}

type ChainMethod =
  | "select"
  | "eq"
  | "in"
  | "order"
  | "limit"
  | "single"
  | "insert"
  | "update"
  | "delete";

const CHAIN_METHODS: ChainMethod[] = [
  "select",
  "eq",
  "in",
  "order",
  "limit",
  "single",
  "insert",
  "update",
  "delete",
];

export type QueryBuilderMock = Record<ChainMethod, jest.Mock> &
  PromiseLike<SupabaseResult>;

/**
 * Creates a chainable Supabase query-builder mock. Every chain method returns
 * the same builder, and the builder is thenable so `await builder.select()...`
 * resolves to the provided result.
 */
export function queryBuilder<T = unknown>(
  result: SupabaseResult<T>
): QueryBuilderMock {
  const builder = {} as QueryBuilderMock;
  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder);
  }
  (builder as { then: PromiseLike<SupabaseResult>["then"] }).then = (
    onFulfilled,
    onRejected
  ) => Promise.resolve(result as SupabaseResult).then(onFulfilled, onRejected);
  return builder;
}
