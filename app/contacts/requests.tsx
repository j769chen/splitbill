import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { Avatar, Button, Card, Text } from "react-native-paper";
import {
  useContactRequests,
  useRespondContactRequest,
  useCancelContactRequest,
} from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { getErrorMessage } from "@/lib/utils";
import { EmptyState } from "@/components/groups/EmptyState";
import type { ContactRequest } from "@/lib/types";

function RequestAvatar({ profile }: { profile: ContactRequest["profile"] }) {
  const theme = useAppTheme();
  if (profile.avatar_url) {
    return <Avatar.Image size={44} source={{ uri: profile.avatar_url }} />;
  }
  return (
    <Avatar.Text
      size={44}
      label={(profile.full_name || "?").charAt(0).toUpperCase()}
      style={{ backgroundColor: theme.colors.secondaryContainer }}
      labelStyle={{ color: theme.colors.onSecondaryContainer }}
    />
  );
}

export default function ContactRequests() {
  const theme = useAppTheme();
  const { data, refetch, isLoading } = useContactRequests();
  const respond = useRespondContactRequest();
  const cancel = useCancelContactRequest();
  const { showError, showSuccess } = useSnackbar();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const isEmpty = !isLoading && incoming.length === 0 && outgoing.length === 0;

  const handleRespond = async (requestId: string, accept: boolean) => {
    setPendingId(requestId);
    try {
      await respond.mutateAsync({ requestId, accept });
      showSuccess(accept ? "Contact added" : "Request declined");
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't update the request. Please try again.")
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setPendingId(requestId);
    try {
      await cancel.mutateAsync(requestId);
      showSuccess("Request cancelled");
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't cancel the request. Please try again.")
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isEmpty && (
          <EmptyState
            icon="account-clock-outline"
            title="No pending requests"
            subtitle="Contact requests you send or receive show up here"
          />
        )}

        {incoming.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: "bold", marginBottom: 12 }}
            >
              Incoming
            </Text>
            <View style={{ gap: 12 }}>
              {incoming.map((request) => (
                <Card key={request.id} mode="elevated">
                  <Card.Content
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <RequestAvatar profile={request.profile} />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                        {request.profile.full_name}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        wants to connect
                      </Text>
                    </View>
                  </Card.Content>
                  <Card.Actions>
                    <Button
                      onPress={() => handleRespond(request.id, false)}
                      disabled={pendingId === request.id}
                    >
                      Decline
                    </Button>
                    <Button
                      mode="contained"
                      onPress={() => handleRespond(request.id, true)}
                      loading={pendingId === request.id && respond.isPending}
                      disabled={pendingId === request.id}
                    >
                      Accept
                    </Button>
                  </Card.Actions>
                </Card>
              ))}
            </View>
          </View>
        )}

        {outgoing.length > 0 && (
          <View>
            <Text
              variant="titleMedium"
              style={{ fontWeight: "bold", marginBottom: 12 }}
            >
              Sent
            </Text>
            <View style={{ gap: 12 }}>
              {outgoing.map((request) => (
                <Card key={request.id} mode="elevated">
                  <Card.Content
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <RequestAvatar profile={request.profile} />
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                        {request.profile.full_name}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        Pending
                      </Text>
                    </View>
                    <Button
                      onPress={() => handleCancel(request.id)}
                      loading={pendingId === request.id && cancel.isPending}
                      disabled={pendingId === request.id}
                    >
                      Cancel
                    </Button>
                  </Card.Content>
                </Card>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
