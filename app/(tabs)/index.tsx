import { View, ScrollView, RefreshControl } from "react-native";
import { Avatar, Badge, Button, Card, IconButton, Text } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";
import { useContacts, useContactRequests } from "@/lib/queries/useContacts";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import { router } from "expo-router";
import { useState, useCallback } from "react";

export default function Dashboard() {
  const theme = useAppTheme();
  const { user } = useAuth();
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

  let balancePrefix = "You are settled up!";
  let balanceAmount = "";
  let balanceSuffix = "";
  let amountColor = theme.colors.onBrand;
  if (net > 0.01) {
    balancePrefix = "You are owed ";
    balanceAmount = formatCurrency(net);
    balanceSuffix = " overall";
    amountColor = theme.colors.success;
  } else if (net < -0.01) {
    balancePrefix = "You owe ";
    balanceAmount = formatCurrency(Math.abs(net));
    balanceSuffix = " overall";
    amountColor = theme.colors.error;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 32,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
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

      <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            Your Groups
          </Text>
          <Button
            mode="contained"
            icon="plus"
            compact
            contentStyle={{ paddingHorizontal: 12 }}
            onPress={() => router.push("/(tabs)/groups/create")}
          >
            New
          </Button>
        </View>
        {!groups || groups.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                No groups yet. Create one to start splitting expenses!
              </Text>
              <Button
                mode="contained"
                style={{ marginTop: 16 }}
                onPress={() => router.push("/(tabs)/groups/create")}
              >
                Create Group
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {groups.map((group) => (
              <Card
                key={group.id}
                mode="elevated"
                onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
              >
                <Card.Content
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  <Avatar.Text
                    size={48}
                    label={group.name.charAt(0).toUpperCase()}
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    labelStyle={{ color: theme.colors.onPrimaryContainer }}
                  />
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                      {group.name}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {group.group_members.length} member
                      {group.group_members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            Contacts
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
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
        </View>
        {!contacts || contacts.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                No contacts yet. Add someone to split one-on-one expenses!
              </Text>
              <Button
                mode="contained"
                style={{ marginTop: 16 }}
                onPress={() => router.push("/contacts/add")}
              >
                Add Contact
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {contacts.map((contact) => {
              const owed = contact.balance > 0.01;
              const owing = contact.balance < -0.01;
              const balanceColor = owed
                ? theme.colors.success
                : owing
                  ? theme.colors.error
                  : theme.colors.onSurfaceVariant;
              const balanceLabel = owed
                ? `owes you ${formatCurrency(contact.balance)}`
                : owing
                  ? `you owe ${formatCurrency(Math.abs(contact.balance))}`
                  : "settled up";

              return (
                <Card
                  key={contact.contact_user_id}
                  mode="elevated"
                  onPress={() =>
                    router.push({
                      pathname: "/contacts/[id]",
                      params: {
                        id: contact.contact_user_id,
                        name: contact.full_name,
                      },
                    })
                  }
                >
                  <Card.Content
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <Avatar.Text
                      size={48}
                      label={contact.full_name.charAt(0).toUpperCase()}
                      style={{ backgroundColor: theme.colors.secondaryContainer }}
                      labelStyle={{ color: theme.colors.onSecondaryContainer }}
                    />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                        {contact.full_name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: balanceColor }}>
                        {balanceLabel}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
