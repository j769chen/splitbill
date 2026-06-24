import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import {
  useContactRequests,
  useRespondContactRequest,
  useCancelContactRequest,
} from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { getErrorMessage } from "@/lib/utils";
import { ContactRequestSection } from "@/components/contacts/ContactRequestSection";
import { EmptyState } from "@/components/groups/EmptyState";

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

        <ContactRequestSection
          title="Incoming"
          requests={incoming}
          pendingId={pendingId}
          respondPending={respond.isPending}
          onDecline={(requestId) => handleRespond(requestId, false)}
          onAccept={(requestId) => handleRespond(requestId, true)}
        />

        <ContactRequestSection
          title="Sent"
          requests={outgoing}
          pendingId={pendingId}
          cancelPending={cancel.isPending}
          onCancel={handleCancel}
          spacing="none"
        />
      </ScrollView>
    </View>
  );
}
