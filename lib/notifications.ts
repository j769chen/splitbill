import { useCallback } from "react";
import { useAsyncStorageState } from "./useAsyncStorageState";

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

function deserializeNotificationPrefs(raw: string): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
}

export function useNotificationPrefs() {
  const {
    value: prefs,
    setValue: setPrefs,
    loading,
  } = useAsyncStorageState<NotificationPrefs>({
    key: STORAGE_KEY,
    initialValue: DEFAULT_NOTIFICATION_PREFS,
    deserialize: deserializeNotificationPrefs,
    serialize: JSON.stringify,
  });

  const setPref = useCallback(
    <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        return next;
      });
    },
    [setPrefs]
  );

  return { prefs, setPref, loading };
}
