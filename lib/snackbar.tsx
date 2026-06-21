import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export type SnackbarVariant = "error" | "success" | "info";

export interface SnackbarAction {
  label: string;
  onPress: () => void;
}

export interface SnackbarOptions {
  variant?: SnackbarVariant;
  /** Auto-dismiss delay in ms. Pass 0 to keep it open until dismissed. */
  duration?: number;
  action?: SnackbarAction;
}

interface SnackbarState {
  id: number;
  message: string;
  variant: SnackbarVariant;
  duration: number;
  action?: SnackbarAction;
}

interface SnackbarContextValue {
  show: (message: string, options?: SnackbarOptions) => void;
  showError: (message: string, options?: Omit<SnackbarOptions, "variant">) => void;
  showSuccess: (
    message: string,
    options?: Omit<SnackbarOptions, "variant">
  ) => void;
  showInfo: (message: string, options?: Omit<SnackbarOptions, "variant">) => void;
  hide: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const VARIANT_CONFIG: Record<
  SnackbarVariant,
  { bgClass: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  error: { bgClass: "bg-danger", icon: "alert-circle" },
  success: { bgClass: "bg-success", icon: "checkmark-circle" },
  info: { bgClass: "bg-primary-500", icon: "information-circle" },
};

const DEFAULT_DURATION = 4000;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setSnackbar(null);
    });
  }, [clearTimer, opacity, translateY]);

  const show = useCallback(
    (message: string, options?: SnackbarOptions) => {
      clearTimer();
      idCounter.current += 1;
      const duration = options?.duration ?? DEFAULT_DURATION;
      const next: SnackbarState = {
        id: idCounter.current,
        message,
        variant: options?.variant ?? "info",
        duration,
        action: options?.action,
      };
      setSnackbar(next);
      AccessibilityInfo.announceForAccessibility?.(message);

      // Reset position, then animate in.
      translateY.setValue(100);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 80,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        hideTimer.current = setTimeout(() => hide(), duration);
      }
    },
    [clearTimer, hide, opacity, translateY]
  );

  const showError = useCallback(
    (message: string, options?: Omit<SnackbarOptions, "variant">) =>
      show(message, { ...options, variant: "error" }),
    [show]
  );
  const showSuccess = useCallback(
    (message: string, options?: Omit<SnackbarOptions, "variant">) =>
      show(message, { ...options, variant: "success" }),
    [show]
  );
  const showInfo = useCallback(
    (message: string, options?: Omit<SnackbarOptions, "variant">) =>
      show(message, { ...options, variant: "info" }),
    [show]
  );

  useEffect(() => clearTimer, [clearTimer]);

  const config = snackbar ? VARIANT_CONFIG[snackbar.variant] : null;

  return (
    <SnackbarContext.Provider
      value={{ show, showError, showSuccess, showInfo, hide }}
    >
      {children}
      {snackbar && config && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrapper,
            { bottom: insets.bottom + 16, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable
            accessibilityRole="alert"
            onPress={hide}
            className={`flex-row items-center w-full max-w-[520px] rounded-xl py-3 px-4 shadow-lg ${config.bgClass}`}
          >
            <Ionicons name={config.icon} size={22} color="#FFFFFF" />
            <Text
              className="flex-1 ml-3 text-white text-sm font-medium"
              numberOfLines={3}
            >
              {snackbar.message}
            </Text>
            {snackbar.action && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  snackbar.action?.onPress();
                  hide();
                }}
                className="ml-1 px-1 py-1"
              >
                <Text className="text-white text-[13px] font-bold tracking-wide">
                  {snackbar.action.label.toUpperCase()}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
});
