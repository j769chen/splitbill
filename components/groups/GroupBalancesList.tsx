import { View } from "react-native";
import type { GroupBalance } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { MemberBalanceCard } from "./MemberBalanceCard";

type BalanceBreakdown = {
  direction: "owes" | "owed";
  name: string;
  amount: number;
};

type GroupBalancesListProps = {
  balances?: GroupBalance[];
  currency: string;
  getBreakdown: (userId: string) => BalanceBreakdown[];
  getAccentColor: (balance: number) => string;
};

export function GroupBalancesList({
  balances,
  currency,
  getBreakdown,
  getAccentColor,
}: GroupBalancesListProps) {
  if (!balances || balances.length === 0) {
    return <EmptyState icon="check-circle-outline" title="All settled up!" />;
  }

  return (
    <View style={{ gap: 12 }}>
      {balances.map((balance) => (
        <MemberBalanceCard
          key={balance.user_id}
          balance={balance}
          breakdown={getBreakdown(balance.user_id)}
          accentColor={getAccentColor(balance.balance)}
          currency={currency}
        />
      ))}
    </View>
  );
}
