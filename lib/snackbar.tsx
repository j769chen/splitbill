import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Pressable } from "react-native";
import { Portal, Snackbar, Text } from "react-native-paper";
import { useAppTheme } from "./theme";

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
  message: string;
  variant: SnackbarVariant;
  duration: number;
  action?: SnackbarAction;
}

interface SnackbarContextValue {
  show: (message: string, options?: SnackbarOptions) => void;
  showError: (
    message: string,
    options?: Omit<SnackbarOptions, "variant">
  ) => void;
  showSuccess: (
    message: string,
    options?: Omit<SnackbarOptions, "variant">
  ) => void;
  showInfo: (
    message: string,
    options?: Omit<SnackbarOptions, "variant">
  ) => void;
  hide: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const DEFAULT_DURATION = 4000;
const PERSIST_DURATION = 1000 * 60 * 60;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [visible, setVisible] = useState(false);

  const hide = useCallback(() => setVisible(false), []);

  const show = useCallback((message: string, options?: SnackbarOptions) => {
    setSnackbar({
      message,
      variant: options?.variant ?? "info",
      duration: options?.duration ?? DEFAULT_DURATION,
      action: options?.action,
    });
    setVisible(true);
  }, []);

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

  const variantStyle: Record<SnackbarVariant, { bg: string; fg: string }> = {
    error: { bg: theme.colors.error, fg: "#FFFFFF" },
    success: { bg: theme.colors.success, fg: "#FFFFFF" },
    info: { bg: theme.colors.inverseSurface, fg: theme.colors.inverseOnSurface },
  };

  const current = snackbar ? variantStyle[snackbar.variant] : variantStyle.info;
  const duration = snackbar
    ? snackbar.duration === 0
      ? PERSIST_DURATION
      : snackbar.duration
    : DEFAULT_DURATION;
  const value = useMemo(
    () => ({ show, showError, showSuccess, showInfo, hide }),
    [hide, show, showError, showInfo, showSuccess]
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Portal>
        <Snackbar
          visible={visible}
          onDismiss={hide}
          duration={duration}
          style={{ backgroundColor: current.bg }}
          theme={{
            ...theme,
            colors: {
              ...theme.colors,
              inverseOnSurface: current.fg,
              inversePrimary: current.fg,
            },
          }}
          icon="close"
          onIconPress={hide}
          iconAccessibilityLabel="Dismiss"
          action={
            snackbar?.action
              ? {
                  label: snackbar.action.label,
                  onPress: () => {
                    snackbar.action?.onPress();
                    hide();
                  },
                }
              : undefined
          }
        >
          <Pressable
            onPress={hide}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss: ${snackbar?.message ?? ""}`}
            testID="snackbar-dismiss"
            style={{ flexGrow: 1 }}
          >
            <Text variant="bodyMedium" style={{ color: current.fg }}>
              {snackbar?.message ?? ""}
            </Text>
          </Pressable>
        </Snackbar>
      </Portal>
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
