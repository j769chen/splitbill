import { View } from "react-native";
import type { ExpenseWithSplits, PaymentWithProfiles } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { ExpenseCard } from "./ExpenseCard";
import { PaymentCard } from "./PaymentCard";

export type GroupActivityItem =
  | { kind: "expense"; ts: string; expense: ExpenseWithSplits }
  | { kind: "payment"; ts: string; payment: PaymentWithProfiles };

type GroupActivityListProps = {
  items: GroupActivityItem[];
  currentUserId?: string;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onEditPayment: (paymentId: string) => void;
};

export function GroupActivityList({
  items,
  currentUserId,
  onDeleteExpense,
  onEditExpense,
  onDeletePayment,
  onEditPayment,
}: GroupActivityListProps) {
  if (items.length === 0) {
    return <EmptyState icon="timeline-text-outline" title="No activity yet" />;
  }

  return (
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
  );
}
