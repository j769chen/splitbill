import { Alert, Platform } from "react-native";

// React Native's Alert is a no-op on web. These helpers fall back to the
// browser's native dialogs so validation messages and confirmations work
// across web and native.

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmText?: string; destructive?: boolean }
) {
  const confirmText = options?.confirmText ?? "OK";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmText,
      style: options?.destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
