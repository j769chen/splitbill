import { View } from "react-native";
import { Text } from "react-native-paper";
import type { ContactRequest } from "@/lib/types";
import { ContactRequestCard } from "./ContactRequestCard";

type ContactRequestSectionProps = {
  title: string;
  requests: ContactRequest[];
  pendingId: string | null;
  respondPending?: boolean;
  cancelPending?: boolean;
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  spacing?: "normal" | "none";
};

export function ContactRequestSection({
  title,
  requests,
  pendingId,
  respondPending,
  cancelPending,
  onAccept,
  onDecline,
  onCancel,
  spacing = "normal",
}: ContactRequestSectionProps) {
  if (requests.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing === "normal" ? 24 : 0 }}>
      <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 12 }}>
        {title}
      </Text>
      <View style={{ gap: 12 }}>
        {requests.map((request) => (
          <ContactRequestCard
            key={request.id}
            request={request}
            pending={pendingId === request.id}
            respondPending={respondPending}
            cancelPending={cancelPending}
            onAccept={onAccept}
            onDecline={onDecline}
            onCancel={onCancel}
          />
        ))}
      </View>
    </View>
  );
}
