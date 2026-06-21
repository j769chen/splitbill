import { useState } from "react";
import { ScrollView, View } from "react-native";
import { List, Text, TouchableRipple } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/lib/theme";

const ANIMATION_MS = 350;

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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const toggle = () => {
    rotation.value = withTiming(expanded ? 0 : 1, { duration: ANIMATION_MS });
    setExpanded((prev) => !prev);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(ANIMATION_MS)}
      style={{
        marginBottom: 12,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: theme.colors.surfaceVariant,
      }}
    >
      <TouchableRipple onPress={toggle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <Text
            variant="titleMedium"
            style={{ flex: 1, color: theme.colors.primary }}
          >
            {question}
          </Text>
          <Animated.View style={chevronStyle}>
            <List.Icon icon="chevron-down" color={theme.colors.onSurfaceVariant} />
          </Animated.View>
        </View>
      </TouchableRipple>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(ANIMATION_MS)}
          exiting={FadeOut.duration(ANIMATION_MS)}
          style={{ paddingHorizontal: 16, paddingBottom: 14 }}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}
          >
            {answer}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

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
