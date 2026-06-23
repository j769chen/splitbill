import { View } from "react-native";
import { Card, Divider, IconButton, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import type { ExpenseWithSplits } from "@/lib/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type ExpenseCardProps = {
  expense: ExpenseWithSplits;
  currentUserId?: string;
  onDelete: (expenseId: string) => void;
};

export function ExpenseCard({
  expense,
  currentUserId,
  onDelete,
}: ExpenseCardProps) {
  const theme = useAppTheme();
  const isPayer = expense.paid_by === currentUserId;

  const userShare =
    expense.expense_splits?.find((split) => split.user_id === currentUserId)
      ?.amount ?? 0;
  const lentAmount = expense.amount - userShare;
  const isInvolved = isPayer || userShare > 0;
  const summaryLabel = isPayer ? "You lent" : "You owe";
  const summaryAmount = isPayer ? lentAmount : userShare;
  const summaryColor =
    summaryAmount <= 0
      ? theme.colors.onSurfaceVariant
      : isPayer
        ? theme.colors.success
        : theme.colors.error;

  return (
    <Card mode="elevated" onLongPress={() => onDelete(expense.id)}>
      <Card.Content>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <MaterialCommunityIcons
            name="receipt"
            size={22}
            color={theme.colors.onSecondaryContainer}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "600" }}>
              {expense.description}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Paid by{" "}
              {isPayer ? "you" : (expense.payer?.full_name ?? "someone")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
              {formatCurrency(expense.amount)}
            </Text>
            <IconButton
              icon="trash-can-outline"
              size={18}
              iconColor={theme.colors.error}
              onPress={() => onDelete(expense.id)}
              style={{ margin: 0, marginLeft: 4 }}
            />
          </View>
        </View>
        <View style={{ marginTop: 12, paddingTop: 12 }}>
          <Divider style={{ marginBottom: 8 }} />
          {isInvolved ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 2,
              }}
            >
              <Text variant="titleMedium" style={{ color: summaryColor }}>
                {summaryLabel}
              </Text>
              <Text
                variant="titleMedium"
                style={{ color: summaryColor, fontWeight: "600" }}
              >
                {formatCurrency(summaryAmount)}
              </Text>
            </View>
          ) : (
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              You&apos;re not involved
            </Text>
          )}
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(expense.date).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}
