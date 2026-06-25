import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, Text } from "react-native-paper";
import {
  type ActivityExpense,
} from "@/lib/queries/useExpenses";
import {
  type ActivityPayment,
} from "@/lib/queries/usePayments";
import {
  type ActivityContactExpense,
  type ActivityContactPayment,
} from "@/lib/queries/useContacts";
import { type ActivitySimplifyDebtsEvent } from "@/lib/queries/useGroups";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";

export type ActivityFeedItem =
  | { kind: "expense"; ts: string; expense: ActivityExpense }
  | { kind: "payment"; ts: string; payment: ActivityPayment }
  | {
      kind: "contact-expense";
      ts: string;
      contactExpense: ActivityContactExpense;
    }
  | {
      kind: "contact-payment";
      ts: string;
      contactPayment: ActivityContactPayment;
    }
  | {
      kind: "simplify-debts";
      ts: string;
      event: ActivitySimplifyDebtsEvent;
    };

type ActivityFeedItemCardProps = {
  item: ActivityFeedItem;
  currentUserId?: string;
};

export function ActivityFeedItemCard({
  item,
  currentUserId,
}: ActivityFeedItemCardProps) {
  switch (item.kind) {
    case "expense":
      return <ExpenseRow item={item.expense} currentUserId={currentUserId} />;
    case "payment":
      return <PaymentRow item={item.payment} currentUserId={currentUserId} />;
    case "contact-expense":
      return (
        <ContactExpenseRow
          item={item.contactExpense}
          currentUserId={currentUserId}
        />
      );
    case "contact-payment":
      return (
        <ContactPaymentRow
          item={item.contactPayment}
          currentUserId={currentUserId}
        />
      );
    case "simplify-debts":
      return (
        <SimplifyDebtsRow item={item.event} currentUserId={currentUserId} />
      );
  }
}

// True when the current user paid for or has a split in the expense.
export function isInvolvedInExpense(
  expense: {
    paid_by: string;
    expense_splits: { user_id: string; amount: number }[];
  },
  currentUserId: string | undefined
): boolean {
  if (expense.paid_by === currentUserId) return true;
  const userShare =
    expense.expense_splits?.find((split) => split.user_id === currentUserId)
      ?.amount ?? 0;
  return userShare > 0;
}

// Net summary for the current user on an expense: positive means they lent
// (get back, shown green), negative means they borrowed (owe, shown red).
function getExpenseSummary(
  expense: {
    amount: number;
    paid_by: string;
    expense_splits: { user_id: string; amount: number }[];
  },
  currentUserId: string | undefined,
  theme: ReturnType<typeof useAppTheme>
) {
  const isPayer = expense.paid_by === currentUserId;
  const userShare =
    expense.expense_splits?.find((split) => split.user_id === currentUserId)
      ?.amount ?? 0;
  const lentAmount = expense.amount - userShare;
  const isInvolved = isPayer || userShare > 0;
  const amount = isPayer ? lentAmount : userShare;
  const color =
    !isInvolved || amount <= 0
      ? theme.colors.onSurfaceVariant
      : isPayer
        ? theme.colors.success
        : theme.colors.error;
  return {
    isInvolved,
    amount,
    color,
    label: isPayer ? "You lent" : "You borrowed",
  };
}

function ExpenseRow({
  item,
  currentUserId,
}: {
  item: ActivityExpense;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const summary = getExpenseSummary(item, currentUserId, theme);

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <MaterialCommunityIcons
              name="receipt"
              size={22}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                {item.description}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {payerName} paid {formatCurrency(item.amount, item.currency)} in{" "}
                {item.groups?.name ?? "a group"}
              </Text>
            </View>
          </View>
          {summary.isInvolved ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="labelSmall" style={{ color: summary.color }}>
                {summary.label}
              </Text>
              <Text
                variant="titleMedium"
                style={{ fontWeight: "bold", color: summary.color }}
              >
                {formatCurrency(summary.amount, item.currency)}
              </Text>
            </View>
          ) : (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Not involved
            </Text>
          )}
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function ContactExpenseRow({
  item,
  currentUserId,
}: {
  item: ActivityContactExpense;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const otherProfile =
    item.paid_by === item.user_lo
      ? item.user_hi_profile
      : item.user_lo_profile;
  const otherName =
    otherProfile?.id === currentUserId
      ? "you"
      : otherProfile?.full_name ?? "someone";
  const summary = getExpenseSummary(item, currentUserId, theme);

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <MaterialCommunityIcons
              name="account-cash"
              size={22}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                {item.description}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {payerName} paid {formatCurrency(item.amount, item.currency)} ·
                with {otherName}
              </Text>
            </View>
          </View>
          {summary.isInvolved ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="labelSmall" style={{ color: summary.color }}>
                {summary.label}
              </Text>
              <Text
                variant="titleMedium"
                style={{ fontWeight: "bold", color: summary.color }}
              >
                {formatCurrency(summary.amount, item.currency)}
              </Text>
            </View>
          ) : (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Not involved
            </Text>
          )}
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PaymentRow({
  item,
  currentUserId,
}: {
  item: ActivityPayment;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const payeeName =
    item.paid_to === currentUserId
      ? "you"
      : item.payee?.full_name ?? "someone";

  return (
    <Card
      mode="contained"
      style={{
        marginBottom: 12,
        backgroundColor: theme.colors.secondaryContainer,
      }}
    >
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
                variant="bodySmall"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                in {item.groups?.name ?? "a group"}
              </Text>
            </View>
          </View>
          <Text
            variant="titleMedium"
            style={{ fontWeight: "bold", color: theme.colors.onSecondaryContainer }}
          >
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        {item.note ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
          >
            {item.note}
          </Text>
        ) : null}
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
        >
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function ContactPaymentRow({
  item,
  currentUserId,
}: {
  item: ActivityContactPayment;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const payeeName =
    item.paid_to === currentUserId
      ? "you"
      : item.payee?.full_name ?? "someone";

  return (
    <Card
      mode="contained"
      style={{
        marginBottom: 12,
        backgroundColor: theme.colors.secondaryContainer,
      }}
    >
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
            </View>
          </View>
          <Text
            variant="titleMedium"
            style={{ fontWeight: "bold", color: theme.colors.onSecondaryContainer }}
          >
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        {item.note ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
          >
            {item.note}
          </Text>
        ) : null}
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
        >
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function SimplifyDebtsRow({
  item,
  currentUserId,
}: {
  item: ActivitySimplifyDebtsEvent;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const actorName =
    item.actor_id === currentUserId
      ? "You"
      : item.actor?.full_name ?? "Someone";
  const action = item.enabled ? "turned on" : "turned off";
  const groupName = item.groups?.name ?? "a group";

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons
            name="call-split"
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "600" }}>
              {actorName} {action} simplify debts
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              in {groupName}
            </Text>
          </View>
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}
