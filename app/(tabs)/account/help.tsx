import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6 pb-10">
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">
          Frequently Asked
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          {FAQS.map((faq, index) => {
            const isOpen = openIndexes.has(index);
            const isLast = index === FAQS.length - 1;
            return (
              <View
                key={faq.question}
                className={isLast ? "" : "border-b border-gray-50"}
              >
                <Pressable
                  role="button"
                  onPress={() => toggleFaq(index)}
                  className="flex-row items-center px-4 py-4 active:bg-gray-50"
                >
                  <Text className="flex-1 text-base text-gray-700 pr-3">
                    {faq.question}
                  </Text>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>
                {isOpen ? (
                  <Text className="px-4 pb-4 -mt-1 text-sm text-gray-500 leading-5">
                    {faq.answer}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text className="text-center text-gray-400 text-xs mt-8">
          SplitBill v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}
