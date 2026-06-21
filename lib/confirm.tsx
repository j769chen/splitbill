import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

interface ConfirmState extends ConfirmOptions {
  visible: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => void;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  const animateIn = useCallback(() => {
    opacity.setValue(0);
    scale.setValue(0.95);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 90,
      }),
    ]).start();
  }, [opacity, scale]);

  const close = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setState(null);
    });
  }, [opacity]);

  const confirm = useCallback<ConfirmFn>(
    (options) => {
      setState({ ...options, visible: true });
      // Defer so the Modal mounts before we kick off the entrance animation.
      requestAnimationFrame(animateIn);
    },
    [animateIn]
  );

  const handleConfirm = useCallback(() => {
    const onConfirm = state?.onConfirm;
    close();
    onConfirm?.();
  }, [close, state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={!!state}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable
            style={styles.backdropPressable}
            onPress={close}
            accessibilityLabel="Dismiss"
          />
          <Animated.View
            style={[styles.card, { transform: [{ scale }] }]}
            accessibilityViewIsModal
          >
            <Text style={styles.title}>{state?.title}</Text>
            {state?.message ? (
              <Text style={styles.message}>{state.message}</Text>
            ) : null}
            <View className="flex-row items-stretch mt-6">
              <Pressable
                accessibilityRole="button"
                onPress={close}
                className="flex-1 py-3.5 rounded-xl items-center justify-center bg-gray-100 active:bg-gray-200"
              >
                <Text className="text-base font-semibold text-gray-700">
                  {state?.cancelText ?? "Cancel"}
                </Text>
              </Pressable>
              <View className="w-2.5" />
              <Pressable
                accessibilityRole="button"
                onPress={handleConfirm}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center active:opacity-80 ${
                  state?.destructive ? "bg-danger" : "bg-primary-500"
                }`}
              >
                <Text className="text-base font-semibold text-white">
                  {state?.confirmText ?? "OK"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
});
