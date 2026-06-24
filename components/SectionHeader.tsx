import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
