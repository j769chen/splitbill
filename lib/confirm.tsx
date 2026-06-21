import React, { createContext, useCallback, useContext, useState } from "react";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { useAppTheme } from "./theme";

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
  const theme = useAppTheme();
  const [state, setState] = useState<ConfirmState | null>(null);

  const close = useCallback(() => setState(null), []);

  const confirm = useCallback<ConfirmFn>((options) => {
    setState({ ...options, visible: true });
  }, []);

  const handleConfirm = useCallback(() => {
    const onConfirm = state?.onConfirm;
    setState(null);
    onConfirm?.();
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Portal>
        <Dialog visible={!!state} onDismiss={close}>
          {state?.title ? <Dialog.Title>{state.title}</Dialog.Title> : null}
          {state?.message ? (
            <Dialog.Content>
              <Text variant="bodyMedium">{state.message}</Text>
            </Dialog.Content>
          ) : null}
          <Dialog.Actions>
            <Button onPress={close}>{state?.cancelText ?? "Cancel"}</Button>
            <Button
              onPress={handleConfirm}
              textColor={state?.destructive ? theme.colors.error : undefined}
            >
              {state?.confirmText ?? "OK"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
