import { Button, Card, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type CallToActionCardProps = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

export function CallToActionCard({
  message,
  actionLabel,
  onAction,
}: CallToActionCardProps) {
  const theme = useAppTheme();

  return (
    <Card mode="contained">
      <Card.Content style={{ alignItems: "center", paddingVertical: 32 }}>
        <Text
          variant="bodyLarge"
          style={{
            color: theme.colors.onSurfaceVariant,
            textAlign: "center",
          }}
        >
          {message}
        </Text>
        <Button mode="contained" style={{ marginTop: 16 }} onPress={onAction}>
          {actionLabel}
        </Button>
      </Card.Content>
    </Card>
  );
}
