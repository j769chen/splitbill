import { useLocalSearchParams, router } from "expo-router";
import { ContactDetailScreen } from "@/components/contacts/ContactDetailScreen";

export default function ActivityContactDetail() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <ContactDetailScreen
      contactUserId={id!}
      name={name}
      onOpenGroup={(groupId) => router.push(`/activity/group/${groupId}`)}
      onAddExpense={() =>
        router.push({
          pathname: "/activity/contacts/add-expense",
          params: { contactUserId: id },
        })
      }
      onEditExpense={(expenseId) =>
        router.push({
          pathname: "/activity/contacts/add-expense",
          params: { contactUserId: id, expenseId },
        })
      }
      onSettleUp={() =>
        router.push({
          pathname: "/activity/contacts/settle-up",
          params: { contactUserId: id },
        })
      }
      onEditPayment={(paymentId) =>
        router.push({
          pathname: "/activity/contacts/settle-up",
          params: { contactUserId: id, paymentId },
        })
      }
    />
  );
}
