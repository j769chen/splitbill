import { List } from "react-native-paper";

type SettingsLinkRowProps = {
  title: string;
  icon: string;
  onPress: () => void;
  color?: string;
  showChevron?: boolean;
};

export function SettingsLinkRow({
  title,
  icon,
  onPress,
  color,
  showChevron = true,
}: SettingsLinkRowProps) {
  return (
    <List.Item
      title={title}
      titleStyle={color ? { color, fontWeight: "500" } : undefined}
      left={(props) => <List.Icon {...props} icon={icon} color={color} />}
      right={
        showChevron
          ? (props) => <List.Icon {...props} icon="chevron-right" />
          : undefined
      }
      onPress={onPress}
    />
  );
}
