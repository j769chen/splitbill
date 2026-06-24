import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/theme";

type FormScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  paddingHorizontal?: number;
  paddingTop?: number;
};

export function FormScreen({
  children,
  header,
  paddingHorizontal = 24,
  paddingTop = 24,
}: FormScreenProps) {
  const theme = useAppTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      {header}
      <ScrollView style={{ flex: 1, paddingHorizontal, paddingTop }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
