import { ScrollView, View } from "react-native";
import { List } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import { FaqItem } from "@/components/account/FaqItem";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How are expenses split?",
    answer:
      "By default an expense is split equally between everyone in the group. When adding an expense you can switch to exact amounts or percentages to customize each person's share.",
  },
  {
    question: "How do I settle up?",
    answer:
      "Open a group and tap Settle Up. SplitBill simplifies who owes whom into the fewest payments, then records the payment so balances update for everyone.",
  },
  {
    question: "Can I add people who aren't on SplitBill?",
    answer:
      "Members are matched by the email address they signed up with. Invite friends to create an account with that email, then add them to your group.",
  },
  {
    question: "What happens when I leave a group?",
    answer:
      "You're removed from the group. If you were the owner, ownership passes to the longest-standing member. If you were the last member, the group and its history are deleted.",
  },
];

export default function HelpAndSupport() {
  const theme = useAppTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}>
        <List.Subheader>Frequently Asked</List.Subheader>
        {FAQS.map((faq) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
          />
        ))}

      </View>
    </ScrollView>
  );
}
