import { List, Switch } from "react-native-paper";

type NotificationToggleItemProps = {
  title: string;
  description: string;
  icon: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function NotificationToggleItem({
  title,
  description,
  icon,
  value,
  onValueChange,
  disabled,
}: NotificationToggleItemProps) {
  return (
    <List.Item
      title={title}
      description={description}
      left={(props) => <List.Icon {...props} icon={icon} />}
      right={() => (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        />
      )}
      style={disabled ? { opacity: 0.4 } : undefined}
    />
  );
}
