import { View, ScrollView, RefreshControl } from "react-native";
import { Avatar, Button, Card, Text } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import { router } from "expo-router";
import { useState, useCallback } from "react";

export default function Dashboard() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { data: balance, refetch: refetchBalance } = useUserTotalBalance();
  const { data: groups, refetch: refetchGroups } = useGroups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchGroups()]);
    setRefreshing(false);
  }, [refetchBalance, refetchGroups]);

  const net = balance?.net ?? 0;

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
        <Text style={{ color: "rgba(255,255,255,0.8)" }} variant="labelLarge">
          Overall Balance
        </Text>
        <Text
          variant="displaySmall"
          style={{
            color: net >= 0 ? "#FFFFFF" : "#FECACA",
            fontWeight: "bold",
            marginTop: 4,
          }}
        >
          {net >= 0 ? "+" : ""}
          {formatCurrency(net)}
        </Text>

        <View style={{ flexDirection: "row", marginTop: 24, gap: 16 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)" }} variant="labelSmall">
              You are owed
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: "#FFFFFF", fontWeight: "bold", marginTop: 4 }}
            >
              {formatCurrency(balance?.totalOwed ?? 0)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, padding: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)" }} variant="labelSmall">
              You owe
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: "#FFFFFF", fontWeight: "bold", marginTop: 4 }}
            >
              {formatCurrency(balance?.totalOwing ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            Your Groups
          </Text>
          <Button
            mode="contained-tonal"
            icon="plus"
            compact
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

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
