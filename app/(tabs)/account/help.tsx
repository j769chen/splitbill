import { ScrollView, View } from "react-native";
import { Card, List, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

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
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.colors.background }}
    >
      <View className="px-6 pt-4 pb-10">
        <List.Subheader>Frequently Asked</List.Subheader>
        <Card mode="contained">
          {/* Each accordion keeps its own open state, so multiple can be
              expanded at the same time. */}
          {FAQS.map((faq) => (
            <List.Accordion key={faq.question} title={faq.question}>
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}
                >
                  {faq.answer}
                </Text>
              </View>
            </List.Accordion>
          ))}
        </Card>

        <Text
          variant="labelSmall"
          style={{
            textAlign: "center",
            color: theme.colors.onSurfaceVariant,
            marginTop: 32,
          }}
        >
          SplitBill v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}
