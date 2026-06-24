import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card, List, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import type { GroupBalance } from "@/lib/types";

export type MemberBreakdownItem = {
  direction: "owes" | "owed";
  name: string;
  amount: number;
};

type MemberBalanceCardProps = {
  balance: GroupBalance;
  breakdown: MemberBreakdownItem[];
  accentColor: string;
  currency?: string;
};

export function MemberBalanceCard({
  balance,
  breakdown,
  accentColor,
  currency,
}: MemberBalanceCardProps) {
  const theme = useAppTheme();
  const isOwed = balance.balance > 0.01;
  const isOwing = balance.balance < -0.01;
  const summary = isOwed
    ? "is owed overall"
    : isOwing
      ? "owes overall"
      : "settled up";

  return (
    <Card
      mode="contained"
      style={{
        overflow: "hidden",
        backgroundColor: theme.colors.surfaceVariant,
      }}
    >
      <List.Accordion
        theme={{ colors: { background: "transparent" } }}
        title={balance.full_name}
        titleStyle={{ color: theme.colors.onSurface, fontWeight: "700" }}
        description={summary}
        descriptionStyle={{ color: accentColor }}
        left={(props) => (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginLeft: props.style?.marginLeft,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: accentColor + "22",
            }}
          >
            <Text style={{ color: accentColor, fontWeight: "700" }}>
              {balance.full_name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        right={({ isExpanded }) => (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: accentColor + "22",
              }}
            >
              <Text
                variant="bodyMedium"
                style={{ fontWeight: "700", color: accentColor }}
              >
                {balance.balance > 0 ? "+" : ""}
                {formatCurrency(balance.balance, currency)}
              </Text>
            </View>
            <List.Icon
              icon={isExpanded ? "chevron-up" : "chevron-down"}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        )}
      >
        <View
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            paddingHorizontal: 16,
            paddingVertical: 4,
          }}
        >
          {breakdown.length === 0 ? (
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                paddingVertical: 10,
              }}
            >
              Settled up with everyone
            </Text>
          ) : (
            breakdown.map((item, i) => {
              const itemColor =
                item.direction === "owes"
                  ? theme.colors.error
                  : theme.colors.success;
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 8,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: theme.colors.outlineVariant,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      item.direction === "owes"
                        ? "arrow-top-right"
                        : "arrow-bottom-left"
                    }
                    size={18}
                    color={itemColor}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurface, flex: 1 }}
                  >
                    {item.direction === "owes" ? "Owes " : "Owed by "}
                    <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ fontWeight: "700", color: itemColor }}
                  >
                    {formatCurrency(item.amount, currency)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </List.Accordion>
    </Card>
  );
}
