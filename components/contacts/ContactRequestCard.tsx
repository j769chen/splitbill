import { View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { ContactRequest } from "@/lib/types";
import { ContactRequestAvatar } from "./ContactRequestAvatar";

type ContactRequestCardProps = {
  request: ContactRequest;
  pending: boolean;
  respondPending?: boolean;
  cancelPending?: boolean;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
};

export function ContactRequestCard({
  request,
  pending,
  respondPending,
  cancelPending,
  onAccept,
  onDecline,
  onCancel,
}: ContactRequestCardProps) {
  const theme = useAppTheme();
  const isIncoming = request.direction === "incoming";

  return (
    <Card mode="elevated">
      <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
        <ContactRequestAvatar profile={request.profile} />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: "600" }}>
            {request.profile.full_name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {isIncoming ? "wants to connect" : "Pending"}
          </Text>
        </View>
        {!isIncoming && onCancel ? (
          <Button
            onPress={() => onCancel(request.id)}
            loading={pending && cancelPending}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
      </Card.Content>
      {isIncoming ? (
        <Card.Actions>
          <Button onPress={() => onDecline?.(request.id)} disabled={pending}>
            Decline
          </Button>
          <Button
            mode="contained"
            onPress={() => onAccept?.(request.id)}
            loading={pending && respondPending}
            disabled={pending}
          >
            Accept
          </Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}
