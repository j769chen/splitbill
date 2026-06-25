import { View, ScrollView, RefreshControl } from "react-native";
import { Badge, Button, IconButton, Text } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";
import { useContacts, useContactRequests } from "@/lib/queries/useContacts";
import { getBalanceColor, getOverallBalanceParts } from "@/lib/balance-display";
import { useDisplayCurrency } from "@/lib/display-currency";
import { useAppTheme } from "@/lib/theme";
import { CallToActionCard } from "@/components/CallToActionCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ContactListItem } from "@/components/contacts/ContactListItem";
import { GroupListItem } from "@/components/groups/GroupListItem";
import { router } from "expo-router";
import { useState, useCallback } from "react";

export default function Dashboard() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { currency: displayCurrency } = useDisplayCurrency();
  const { data: balance, refetch: refetchBalance } = useUserTotalBalance();
  const { data: groups, refetch: refetchGroups } = useGroups();
  const { data: contacts, refetch: refetchContacts } = useContacts();
  const { data: contactRequests, refetch: refetchContactRequests } =
    useContactRequests();
  const [refreshing, setRefreshing] = useState(false);

  const incomingRequestCount = contactRequests?.incoming.length ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBalance(),
      refetchGroups(),
      refetchContacts(),
      refetchContactRequests(),
    ]);
    setRefreshing(false);
  }, [refetchBalance, refetchGroups, refetchContacts, refetchContactRequests]);

  const net = balance?.net ?? 0;

  const {
    prefix: balancePrefix,
    amount: balanceAmount,
    suffix: balanceSuffix,
  } = getOverallBalanceParts(net, displayCurrency);
  const amountColor = balanceAmount
    ? getBalanceColor(net, theme.colors)
    : theme.colors.onBrand;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 32,
          backgroundColor: theme.colors.brand,
        }}
      >
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.onBrand,
            fontWeight: "bold",
            marginTop: 4,
          }}
        >
          {balancePrefix}
          {balanceAmount ? (
            <Text style={{ color: amountColor, fontWeight: "bold" }}>
              {balanceAmount}
            </Text>
          ) : null}
          {balanceSuffix}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <SectionHeader
            title="Your Groups"
            action={
              <Button
                mode="contained"
                icon="plus"
                compact
                contentStyle={{ paddingHorizontal: 12 }}
                onPress={() => router.push("/(tabs)/groups/create")}
              >
                New
              </Button>
            }
          />
          {!groups || groups.length === 0 ? (
            <CallToActionCard
              message="No groups yet. Create one to start splitting expenses!"
              actionLabel="Create Group"
              onAction={() => router.push("/(tabs)/groups/create")}
            />
          ) : (
            <View style={{ gap: 12 }}>
              {groups.map((group) => (
                <GroupListItem
                  key={group.id}
                  group={group}
                  avatarSize={48}
                  showChevron={false}
                  style={{ marginBottom: 0 }}
                  onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
          <SectionHeader
            title="Contacts"
            action={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View>
                  <IconButton
                    icon="account-clock-outline"
                    mode="contained-tonal"
                    size={20}
                    onPress={() => router.push("/contacts/requests")}
                    accessibilityLabel="Contact requests"
                  />
                  {incomingRequestCount > 0 && (
                    <Badge
                      style={{ position: "absolute", top: 2, right: 2 }}
                      size={18}
                    >
                      {incomingRequestCount}
                    </Badge>
                  )}
                </View>
                <Button
                  mode="contained"
                  icon="plus"
                  compact
                  contentStyle={{ paddingHorizontal: 12 }}
                  onPress={() => router.push("/contacts/add")}
                >
                  New
                </Button>
              </View>
            }
          />
          {!contacts || contacts.length === 0 ? (
            <CallToActionCard
              message="No contacts yet. Add someone to split one-on-one expenses!"
              actionLabel="Add Contact"
              onAction={() => router.push("/contacts/add")}
            />
          ) : (
            <View style={{ gap: 12 }}>
              {contacts.map((contact) => (
                <ContactListItem
                  key={contact.contact_user_id}
                  contact={contact}
                  currency={displayCurrency}
                  onPress={() =>
                    router.push({
                      pathname: "/contacts/[id]",
                      params: {
                        id: contact.contact_user_id,
                        name: contact.full_name,
                      },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
