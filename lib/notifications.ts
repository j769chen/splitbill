import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface NotificationPrefs {
  pushEnabled: boolean;
  newExpenses: boolean;
  settlements: boolean;
  groupInvites: boolean;
  paymentReminders: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pushEnabled: true,
  newExpenses: true,
  settlements: true,
  groupInvites: true,
  paymentReminders: false,
};

const STORAGE_KEY = "@splitbill/notification-prefs";

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) });
        } catch {
          // Ignore corrupted values and fall back to defaults.
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setPref = useCallback(
    <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  return { prefs, setPref, loading };
}
