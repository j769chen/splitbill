import { useCallback, useEffect, useState, type SetStateAction } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UseAsyncStorageStateOptions<T> {
  key: string;
  initialValue: T;
  deserialize?: (raw: string) => T;
  serialize?: (value: T) => string;
}

function defaultSerialize<T>(value: T): string {
  return String(value);
}

export function useAsyncStorageState<T>({
  key,
  initialValue,
  deserialize,
  serialize = defaultSerialize,
}: UseAsyncStorageStateOptions<T>) {
  const [value, setValueState] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!mounted || raw === null) return;
        try {
          setValueState(deserialize ? deserialize(raw) : (raw as T));
        } catch {
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [deserialize, initialValue, key]);

  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(prev)
            : next;
        AsyncStorage.setItem(key, serialize(resolved)).catch(() => {});
        return resolved;
      });
    },
    [key, serialize]
  );

  return { value, setValue, loading };
}
