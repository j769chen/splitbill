import { View } from "react-native";
import { Card, Divider, IconButton, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import type { ExpenseWithSplits } from "@/lib/types";

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
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "600" }}>
              {expense.description}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Paid by{" "}
              {expense.payer?.full_name ?? (isPayer ? "you" : "someone")}
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
        {expense.expense_splits && expense.expense_splits.length > 0 && (
          <View style={{ marginTop: 12, paddingTop: 12 }}>
            <Divider style={{ marginBottom: 8 }} />
            {expense.expense_splits.map((split) => (
              <View
                key={split.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 2,
                }}
              >
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {split.profiles?.full_name ?? "Unknown"}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {formatCurrency(split.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
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
