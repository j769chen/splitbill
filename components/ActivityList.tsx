import { View } from "react-native";
import { Text } from "react-native-paper";
import { EmptyState } from "@/components/EmptyState";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import { PaymentCard } from "@/components/groups/PaymentCard";
import type {
  ContactExpenseWithSplits,
  ContactPaymentWithProfiles,
  ExpenseWithSplits,
  PaymentWithProfiles,
} from "@/lib/types";

export type ActivityListItem =
  | {
      kind: "expense";
      ts: string;
      expense: ExpenseWithSplits | ContactExpenseWithSplits;
    }
  | {
      kind: "payment";
      ts: string;
      payment: PaymentWithProfiles | ContactPaymentWithProfiles;
    };

type EmptyStateConfig = {
  icon?: React.ComponentProps<typeof EmptyState>["icon"];
  title: string;
  subtitle?: string;
};

type ActivityListProps = {
  items: ActivityListItem[];
  title?: string;
  emptyState?: EmptyStateConfig;
  currentUserId?: string;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onEditPayment: (paymentId: string) => void;
};

export function ActivityList({
  items,
  title,
  emptyState,
  currentUserId,
  onDeleteExpense,
  onEditExpense,
  onDeletePayment,
  onEditPayment,
}: ActivityListProps) {
  if (items.length === 0) {
    return emptyState ? <EmptyState {...emptyState} /> : null;
  }

  return (
    <View>
      {title ? (
        <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 12 }}>
          {title}
        </Text>
      ) : null}
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
