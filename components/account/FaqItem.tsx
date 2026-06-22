import { useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { List, Text, TouchableRipple } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@/lib/theme";

const ANIMATION_MS = 350;

type FaqItemProps = {
  question: string;
  answer: string;
};

export function FaqItem({ question, answer }: FaqItemProps) {
  const theme = useAppTheme();
  // 0 = collapsed, 1 = expanded. Drives both the body height and the chevron.
  const progress = useSharedValue(0);
  // The body's natural height, measured once it has laid out. Animating between
  // 0 and this keeps the header completely static while the body opens/closes.
  const [contentHeight, setContentHeight] = useState(0);

  const toggle = () => {
    progress.value = withTiming(progress.value > 0.5 ? 0 : 1, {
      duration: ANIMATION_MS,
    });
  };

  const onContentLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    if (measured > 0 && measured !== contentHeight) setContentHeight(measured);
  };

  const bodyStyle = useAnimatedStyle(() => ({
    height: contentHeight * progress.value,
    overflow: "hidden",
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <View
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
            <List.Icon
              icon="chevron-down"
              color={theme.colors.onSurfaceVariant}
            />
          </Animated.View>
        </View>
      </TouchableRipple>

      <Animated.View style={bodyStyle}>
        {/* Measured at its natural height regardless of the clipped parent, so
            we know how far to animate. */}
        <View
          onLayout={onContentLayout}
          style={{ paddingHorizontal: 16, paddingBottom: 14 }}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}
          >
            {answer}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
