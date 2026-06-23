import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, IconButton, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import type { PaymentWithProfiles } from "@/lib/types";

type PaymentCardProps = {
  payment: PaymentWithProfiles;
  currentUserId?: string;
  onDelete?: (paymentId: string) => void;
};

export function PaymentCard({
  payment,
  currentUserId,
  onDelete,
}: PaymentCardProps) {
  const theme = useAppTheme();
  const isPayer = payment.paid_by === currentUserId;
  const canDelete = !!onDelete;

  const payerName = isPayer ? "You" : (payment.payer?.full_name ?? "Someone");
  const payeeName =
    payment.paid_to === currentUserId
      ? "you"
      : (payment.payee?.full_name ?? "someone");

  return (
    <Card
      mode="contained"
      style={{ backgroundColor: theme.colors.secondaryContainer }}
      onLongPress={canDelete ? () => onDelete!(payment.id) : undefined}
    >
      <Card.Content>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          >
            <MaterialCommunityIcons
              name="cash-fast"
              size={22}
              color={theme.colors.onSecondaryContainer}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="titleMedium"
                style={{
                  fontWeight: "600",
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                {payerName} paid {payeeName}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                Payment
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              variant="titleMedium"
              style={{
                fontWeight: "bold",
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {formatCurrency(payment.amount)}
            </Text>
            {canDelete && (
              <IconButton
                icon="trash-can-outline"
                size={18}
                iconColor={theme.colors.error}
                onPress={() => onDelete!(payment.id)}
                style={{ margin: 0, marginLeft: 4 }}
              />
            )}
          </View>
        </View>
        {payment.note ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
          >
            {payment.note}
          </Text>
        ) : null}
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
        >
          {new Date(payment.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}
