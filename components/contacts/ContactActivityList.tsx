import { View } from "react-native";
import { Text } from "react-native-paper";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import { PaymentCard } from "@/components/groups/PaymentCard";
import type {
  ContactExpenseWithSplits,
  ContactPaymentWithProfiles,
} from "@/lib/types";

export type ContactActivityItem =
  | { kind: "expense"; ts: string; expense: ContactExpenseWithSplits }
  | { kind: "payment"; ts: string; payment: ContactPaymentWithProfiles };

type ContactActivityListProps = {
  items: ContactActivityItem[];
  showTitle: boolean;
  currentUserId?: string;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onEditPayment: (paymentId: string) => void;
};

export function ContactActivityList({
  items,
  showTitle,
  currentUserId,
  onDeleteExpense,
  onEditExpense,
  onDeletePayment,
  onEditPayment,
}: ContactActivityListProps) {
  if (items.length === 0) return null;

  return (
    <View>
      {showTitle && (
        <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 12 }}>
          One-on-one
        </Text>
      )}
      <View style={{ gap: 12 }}>
        {items.map((item) =>
          item.kind === "expense" ? (
            <ExpenseCard
              key={`expense-${item.expense.id}`}
              expense={item.expense}
              currentUserId={currentUserId}
              onDelete={onDeleteExpense}
              onEdit={onEditExpense}
            />
          ) : (
            <PaymentCard
              key={`payment-${item.payment.id}`}
              payment={item.payment}
              currentUserId={currentUserId}
              onDelete={onDeletePayment}
              onEdit={onEditPayment}
            />
          )
        )}
      </View>
    </View>
  );
}
